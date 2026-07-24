import { PrismaClient, Permission } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Varsayilan sistem rolleri ve izinleri
const SYSTEM_ROLES: {
  name: string;
  description: string;
  permissions: Permission[];
}[] = [
  {
    name: 'Calisan',
    description: 'Temel bildirim yapabilen calisan.',
    permissions: [
      'REPORT_CREATE_ACCIDENT',
      'REPORT_CREATE_NEARMISS',
      'REPORT_VIEW_OWN',
    ],
  },
  {
    name: 'Birim Sorumlusu',
    description: 'Kendi biriminin bildirimlerini yoneten sorumlu.',
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
    name: 'ISG Uzmani',
    description: 'Tum bildirimleri goren, sorusturan ISG uzmani.',
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
    name: 'Yonetici',
    description: 'Kullanici onayi ve yetkilendirme yapan yonetici.',
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

const DEFAULT_DEPARTMENTS = [
  { name: 'Uretim', code: 'URT' },
  { name: 'Bakim', code: 'BKM' },
  { name: 'Depo / Lojistik', code: 'LOJ' },
  { name: 'Kalite', code: 'KAL' },
  { name: 'Idari Isler', code: 'IDR' },
];

async function main() {
  console.log('Seed baslatiliyor...');

  // 1) Sistem rolleri
  for (const role of SYSTEM_ROLES) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { permissions: role.permissions, description: role.description },
      create: { ...role, isSystem: true },
    });
  }
  console.log(`${SYSTEM_ROLES.length} sistem rolu hazir.`);

  // 2) Varsayilan birimler
  for (const dep of DEFAULT_DEPARTMENTS) {
    await prisma.department.upsert({
      where: { name: dep.name },
      update: {},
      create: dep,
    });
  }
  console.log(`${DEFAULT_DEPARTMENTS.length} birim hazir.`);

  // 3) Onceden tanimli super admin
  const email = (process.env.SUPER_ADMIN_EMAIL || 'admin@hse.local').toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD || 'Admin123!';
  const name = process.env.SUPER_ADMIN_NAME || 'Sistem Yoneticisi';
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
