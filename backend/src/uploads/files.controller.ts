import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  NotFoundException,
  Param,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { canUserViewReport } from '../reports/report-access';

// Presigned URL gecerlilik suresi (saniye). En fazla 5 dakika.
const PRESIGNED_URL_TTL_SECONDS = 300;

// Yuklenen dosyalari MinIO'dan sunar.
// ARTIK HERKESE ACIK DEGIL: gecerli JWT ve bildirim gorme yetkisi gerekir.
@Controller('files')
export class FilesController {
  constructor(
    private storage: StorageService,
    private prisma: PrismaService,
  ) {}

  /**
   * Object key dogrulamasi.
   * Anahtarlar StorageService.put icinde "<timestamp>-<hex><uzanti>"
   * bicimindedir; bu yuzden yalnizca duz, tek parcali adlar kabul edilir.
   * Not: Nest @Param degeri bir kez URL-decode eder; burada TEKRAR decode
   * edilmez (cift decode ile filtre atlatmayi onlemek icin).
   */
  private assertValidKey(key: string) {
    const valid =
      typeof key === 'string' &&
      key.length > 0 &&
      key.length <= 200 &&
      /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(key) &&
      !key.includes('..');

    if (!valid) {
      throw new BadRequestException('Geçersiz dosya anahtarı.');
    }
  }

  /**
   * Anahtarin gercekten bir bildirimin ekinde gectigini dogrular ve
   * kullanicinin o bildirimi gorme yetkisini kontrol eder.
   * Ek kaydi ayri bir tabloda degil, Report.attachments (String[]) icinde
   * "/api/files/<key>" bicimide tutuluyor.
   */
  private async assertUserMayAccess(key: string, user: AuthUser) {
    const path = `/api/files/${key}`;

    // Dosya ya dogrudan bir bildirimin ekinde, ya da o bildirime bagli bir
    // duzeltici faaliyetin ekinde olabilir. Her iki durumda da yetki, ekin
    // ait oldugu BILDIRIMIN gorunurlugu uzerinden belirlenir.
    const [reports, actions] = await Promise.all([
      this.prisma.report.findMany({
        where: { attachments: { has: path } },
        select: {
          reporterId: true,
          assignedToId: true,
          departmentId: true,
        },
      }),
      this.prisma.correctiveAction.findMany({
        where: { attachments: { has: path } },
        select: {
          report: {
            select: {
              reporterId: true,
              assignedToId: true,
              departmentId: true,
            },
          },
        },
      }),
    ]);

    const owners = [...reports, ...actions.map((a) => a.report)];

    // Hicbir bildirime/faaliyete bagli olmayan anahtar servis edilmez.
    if (owners.length === 0) {
      throw new NotFoundException('Dosya bulunamadı.');
    }

    // Ayni dosya birden fazla kayda bagliysa, birini gormek yeterlidir.
    if (!owners.some((r) => canUserViewReport(r, user))) {
      throw new ForbiddenException('Bu dosyayı görme yetkiniz yok.');
    }
  }

  // Not: Bu iki parcali route, tek parcali ':key' route'undan once
  // tanimlanir. (Segment sayilari farkli oldugu icin cakisma olmasa da
  // ozgul olan once gelsin.)
  @Get(':key/access-url')
  async accessUrl(@Param('key') key: string, @CurrentUser() user: AuthUser) {
    this.assertValidKey(key);
    await this.assertUserMayAccess(key, user);

    // Dosya gercekten var mi? (yoksa imzali URL uretmenin anlami yok)
    try {
      await this.storage.getStat(key);
    } catch {
      throw new NotFoundException('Dosya bulunamadı.');
    }

    const url = await this.storage.getPresignedUrl(
      key,
      PRESIGNED_URL_TTL_SECONDS,
    );

    // URL yalnizca yanitta doner; loglanmaz, veritabanina yazilmaz.
    return { url, expiresIn: PRESIGNED_URL_TTL_SECONDS };
  }

  @Get(':key')
  async serve(
    @Param('key') key: string,
    @Headers('range') range: string | undefined,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    this.assertValidKey(key);
    await this.assertUserMayAccess(key, user);

    let stat;
    try {
      stat = await this.storage.getStat(key);
    } catch {
      throw new NotFoundException('Dosya bulunamadı.');
    }

    const contentType =
      (stat.metaData && stat.metaData['content-type']) ||
      'application/octet-stream';
    const size = stat.size;

    // Korunan icerik ortak/proxy cache'e girmemeli.
    const cacheHeaders = {
      'Cache-Control': 'private, no-store',
      Pragma: 'no-cache',
    };

    // Video icin Range (kismi icerik) destegi -> oynatici ileri/geri sarabilir
    if (range) {
      const match = /bytes=(\d*)-(\d*)/.exec(range);
      const start = match && match[1] ? parseInt(match[1], 10) : 0;
      const end = match && match[2] ? parseInt(match[2], 10) : size - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
        ...cacheHeaders,
      });

      const stream = await this.storage.getPartialStream(key, start, chunkSize);
      stream.pipe(res);
      return;
    }

    res.writeHead(200, {
      'Content-Length': size,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      ...cacheHeaders,
    });
    const stream = await this.storage.getStream(key);
    stream.pipe(res);
  }
}
