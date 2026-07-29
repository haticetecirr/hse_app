import { PrismaClient, Permission } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Varsayilan sistem rolleri ve izinleri.
// legacyName: Turkce karakter duzeltmesi oncesindeki ad. Ayni kaydin
// yeniden olusturulmamasi icin once bu adla aranir (bkz. upsertRole).
const SYSTEM_ROLES: {
  name: string;
  legacyName?: string;
  description: string;
  permissions: Permission[];
}[] = [
  {
    name: 'Çalışan',
    legacyName: 'Calisan',
    description: 'Temel bildirim yapabilen çalışan.',
    permissions: [
      'REPORT_CREATE_ACCIDENT',
      'REPORT_CREATE_NEARMISS',
      'REPORT_VIEW_OWN',
    ],
  },
  {
    name: 'Birim Sorumlusu',
    description: 'Kendi biriminin bildirimlerini yöneten sorumlu.',
    permissions: [
      'REPORT_CREATE_ACCIDENT',
      'REPORT_CREATE_NEARMISS',
      'REPORT_VIEW_OWN',
      'REPORT_VIEW_DEPARTMENT',
      'REPORT_ASSIGN',
      'ACTION_MANAGE',
      'DASHBOARD_VIEW',
    ],
  },
  {
    name: 'İSG Uzmanı',
    legacyName: 'ISG Uzmani',
    description: 'Tüm bildirimleri gören, soruşturan İSG uzmanı.',
    permissions: [
      'REPORT_CREATE_ACCIDENT',
      'REPORT_CREATE_NEARMISS',
      'REPORT_VIEW_OWN',
      'REPORT_VIEW_DEPARTMENT',
      'REPORT_VIEW_ALL',
      'REPORT_UPDATE',
      'REPORT_INVESTIGATE',
      'REPORT_ASSIGN',
      'REPORT_CLOSE',
      'ACTION_MANAGE',
      'NOTIFICATION_SEND',
      'DASHBOARD_VIEW',
    ],
  },
  {
    name: 'Yönetici',
    legacyName: 'Yonetici',
    description: 'Kullanıcı onayı ve yetkilendirme yapan yönetici.',
    permissions: [
      'USER_VIEW',
      'USER_APPROVE',
      'USER_MANAGE',
      'ROLE_MANAGE',
      'DEPARTMENT_MANAGE',
      'NOTIFICATION_SEND',
      'DASHBOARD_VIEW',
      'REPORT_VIEW_ALL',
      'AUDIT_VIEW',
    ],
  },
];

const DEFAULT_DEPARTMENTS: {
  name: string;
  legacyName?: string;
  code: string;
}[] = [
  { name: 'Üretim', legacyName: 'Uretim', code: 'URT' },
  { name: 'Bakım', legacyName: 'Bakim', code: 'BKM' },
  { name: 'Depo / Lojistik', code: 'LOJ' },
  { name: 'Kalite', code: 'KAL' },
  { name: 'İdari İşler', legacyName: 'Idari Isler', code: 'IDR' },
];

// Ad degisikligine dayanikli rol upsert'i.
// Once guncel ad, sonra eski (legacy) ad aranir; boylece Turkce karakter
// duzeltmesi mevcut veritabaninda ikinci bir rol olusturmaz.
async function upsertRole(role: (typeof SYSTEM_ROLES)[number]) {
  const { legacyName, ...data } = role;

  const current = await prisma.role.findUnique({ where: { name: data.name } });
  const legacy = legacyName
    ? await prisma.role.findUnique({ where: { name: legacyName } })
    : null;

  // Iki ayri kayit birden varsa otomatik birlestirme yapilmaz.
  if (current && legacy && current.id !== legacy.id) {
    throw new Error(
      `Hem "${legacyName}" hem "${data.name}" adli rol mevcut. ` +
        'Otomatik birlestirme yapilmadi; kullanici atamalarini kontrol edip ' +
        'birini elle kaldirin.',
    );
  }

  const target = current ?? legacy;
  if (target) {
    await prisma.role.update({
      where: { id: target.id },
      data: {
        name: data.name,
        description: data.description,
        permissions: data.permissions,
      },
    });
    return;
  }

  await prisma.role.create({ data: { ...data, isSystem: true } });
}

// Ad degisikligine dayanikli birim upsert'i.
// Mevcut birimlerde yalnizca ad duzeltilir; kod ve uyelikler korunur.
async function upsertDepartment(dep: (typeof DEFAULT_DEPARTMENTS)[number]) {
  const { legacyName, ...data } = dep;

  const current = await prisma.department.findUnique({
    where: { name: data.name },
  });
  const legacy = legacyName
    ? await prisma.department.findUnique({ where: { name: legacyName } })
    : null;

  if (current && legacy && current.id !== legacy.id) {
    throw new Error(
      `Hem "${legacyName}" hem "${data.name}" adli birim mevcut. ` +
        'Otomatik birlestirme yapilmadi; birim uyeliklerini kontrol edip ' +
        'birini elle kaldirin.',
    );
  }

  if (current) return; // Zaten guncel adla var, dokunma
  if (legacy) {
    await prisma.department.update({
      where: { id: legacy.id },
      data: { name: data.name },
    });
    return;
  }

  await prisma.department.create({ data });
}

async function main() {
  console.log('Seed baslatiliyor...');

  // 1) Sistem rolleri
  for (const role of SYSTEM_ROLES) {
    await upsertRole(role);
  }
  console.log(`${SYSTEM_ROLES.length} sistem rolu hazir.`);

  // 2) Varsayilan birimler
  for (const dep of DEFAULT_DEPARTMENTS) {
    await upsertDepartment(dep);
  }
  console.log(`${DEFAULT_DEPARTMENTS.length} birim hazir.`);

  // 3) Onceden tanimli super admin
  const email = (process.env.SUPER_ADMIN_EMAIL || 'admin@hse.local').toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD || 'Admin123!';
  const name = process.env.SUPER_ADMIN_NAME || 'Sistem Yöneticisi';
  const [firstName, ...rest] = name.split(' ');
  const lastName = rest.join(' ') || 'Admin';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        status: 'VERIFIED',
        isSuperAdmin: true,
        verifiedAt: new Date(),
      },
    });
    console.log(`Super admin olusturuldu: ${email} / ${password}`);
  } else {
    console.log(`Super admin zaten var: ${email}`);
  }

  console.log('Seed tamamlandi.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
