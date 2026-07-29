/**
 * Mevcut veritabanindaki gorunen etiketleri (rol adi, birim adi ve varsayilan
 * sistem yoneticisinin adi) Turkce karakterli hallerine cevirir.
 *
 * Guvenlik kurallari:
 *  - Hicbir kayit SILINMEZ, hicbir iliski (roleId / departmentId / uyelik)
 *    degistirilmez. Yalnizca "name" alanlari guncellenir.
 *  - Tekrar tekrar calistirilabilir (idempotent). Ikinci calistirmada
 *    yapacak is bulamaz ve hata vermez.
 *  - Eski ve yeni adli iki AYRI kayit ayni anda varsa otomatik birlestirme
 *    yapilmaz; islem hic baslatilmadan durdurulur.
 *  - Tum guncellemeler tek bir transaction icinde uygulanir; herhangi bir
 *    adim hata verirse hicbiri kalici olmaz.
 *
 * Calistirma:  npm run prisma:normalize-labels
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Eski ad -> yeni ad. Listede olmayan roller/birimler hic ellenmez.
const ROLE_RENAMES: { from: string; to: string }[] = [
  { from: 'Calisan', to: 'Çalışan' },
  { from: 'ISG Uzmani', to: 'İSG Uzmanı' },
  { from: 'Yonetici', to: 'Yönetici' },
];

const DEPARTMENT_RENAMES: { from: string; to: string }[] = [
  { from: 'Uretim', to: 'Üretim' },
  { from: 'Bakim', to: 'Bakım' },
  { from: 'Idari Isler', to: 'İdari İşler' },
];

// Varsayilan super admin gorunen adi: "Sistem Yoneticisi" -> "Sistem Yöneticisi"
const SUPER_ADMIN_NAME = {
  from: { firstName: 'Sistem', lastName: 'Yoneticisi' },
  to: { firstName: 'Sistem', lastName: 'Yöneticisi' },
};

type Plan = {
  roleUpdates: { id: string; from: string; to: string }[];
  departmentUpdates: { id: string; from: string; to: string }[];
  superAdminIds: string[];
  conflicts: string[];
  skipped: string[];
};

async function buildPlan(): Promise<Plan> {
  const plan: Plan = {
    roleUpdates: [],
    departmentUpdates: [],
    superAdminIds: [],
    conflicts: [],
    skipped: [],
  };

  for (const { from, to } of ROLE_RENAMES) {
    const legacy = await prisma.role.findUnique({ where: { name: from } });
    const current = await prisma.role.findUnique({ where: { name: to } });

    if (legacy && current && legacy.id !== current.id) {
      plan.conflicts.push(
        `Rol: hem "${from}" hem "${to}" adli iki ayri kayit var.`,
      );
      continue;
    }
    if (legacy) {
      plan.roleUpdates.push({ id: legacy.id, from, to });
    } else if (current) {
      plan.skipped.push(`Rol "${to}" zaten guncel.`);
    } else {
      plan.skipped.push(`Rol "${from}" / "${to}" bulunamadi, atlandi.`);
    }
  }

  for (const { from, to } of DEPARTMENT_RENAMES) {
    const legacy = await prisma.department.findUnique({ where: { name: from } });
    const current = await prisma.department.findUnique({ where: { name: to } });

    if (legacy && current && legacy.id !== current.id) {
      plan.conflicts.push(
        `Birim: hem "${from}" hem "${to}" adli iki ayri kayit var.`,
      );
      continue;
    }
    if (legacy) {
      plan.departmentUpdates.push({ id: legacy.id, from, to });
    } else if (current) {
      plan.skipped.push(`Birim "${to}" zaten guncel.`);
    } else {
      plan.skipped.push(`Birim "${from}" / "${to}" bulunamadi, atlandi.`);
    }
  }

  const admins = await prisma.user.findMany({
    where: {
      isSuperAdmin: true,
      firstName: SUPER_ADMIN_NAME.from.firstName,
      lastName: SUPER_ADMIN_NAME.from.lastName,
    },
    select: { id: true, email: true },
  });
  plan.superAdminIds = admins.map((a) => a.id);
  if (admins.length === 0) {
    plan.skipped.push(
      'Varsayilan "Sistem Yoneticisi" adli super admin bulunamadi, atlandi.',
    );
  }

  return plan;
}

async function main() {
  console.log('Turkce etiket normalizasyonu baslatiliyor...\n');

  const plan = await buildPlan();

  // Cakisma varsa hicbir sey uygulanmaz.
  if (plan.conflicts.length > 0) {
    console.error('DURDURULDU - otomatik birlestirme yapilmaz:\n');
    for (const c of plan.conflicts) console.error(`  ! ${c}`);
    console.error(
      '\nBu kayitlarin hangisinin kullanildigini (kullanici/birim atamalari) ' +
        'kontrol edip fazlaligi elle kaldirin, sonra scripti tekrar calistirin.\n' +
        'Veritabaninda HICBIR degisiklik yapilmadi.',
    );
    process.exitCode = 1;
    return;
  }

  const totalUpdates =
    plan.roleUpdates.length +
    plan.departmentUpdates.length +
    plan.superAdminIds.length;

  if (totalUpdates === 0) {
    console.log('Yapilacak degisiklik yok - tum etiketler zaten guncel.');
    for (const s of plan.skipped) console.log(`  - ${s}`);
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const u of plan.roleUpdates) {
      await tx.role.update({ where: { id: u.id }, data: { name: u.to } });
      console.log(`  + Rol guncellendi: "${u.from}" -> "${u.to}"`);
    }

    for (const u of plan.departmentUpdates) {
      await tx.department.update({ where: { id: u.id }, data: { name: u.to } });
      console.log(`  + Birim guncellendi: "${u.from}" -> "${u.to}"`);
    }

    if (plan.superAdminIds.length > 0) {
      await tx.user.updateMany({
        where: { id: { in: plan.superAdminIds } },
        data: {
          firstName: SUPER_ADMIN_NAME.to.firstName,
          lastName: SUPER_ADMIN_NAME.to.lastName,
        },
      });
      console.log(
        `  + Super admin adi guncellendi (${plan.superAdminIds.length} kayit): ` +
          `"${SUPER_ADMIN_NAME.from.firstName} ${SUPER_ADMIN_NAME.from.lastName}" -> ` +
          `"${SUPER_ADMIN_NAME.to.firstName} ${SUPER_ADMIN_NAME.to.lastName}"`,
      );
    }
  });

  for (const s of plan.skipped) console.log(`  - ${s}`);

  console.log(
    `\nTamamlandi. ${totalUpdates} kayit guncellendi. ` +
      'Hicbir kayit silinmedi, hicbir iliski degistirilmedi.',
  );
}

main()
  .catch((e) => {
    console.error('\nHATA - degisiklikler geri alindi:');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
