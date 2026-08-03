import {
  BadRequestException,
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { StorageService } from '../storage/storage.service';

// Kabul edilen dosya turleri. Kameradan cekilenler (image/jpeg, video/webm,
// video/mp4) ve dosya seciciyle gelen yaygin turler kapsanir. HEIC/HEIF
// iPhone fotograflari, GIF ise mevcut davranis icin listede tutulur.
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
];

const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime', // .mov (iPhone)
];

const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

// Multer'in sert ust siniri (mevcut deger korunuyor). Tip bazli daha dar
// sinirlar asagida, dosyalar bellege alindiktan sonra uygulanir.
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB
const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15 MB
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB

function mb(bytes: number) {
  return Math.round(bytes / (1024 * 1024));
}

@Controller('uploads')
export class UploadsController {
  constructor(private storage: StorageService) {}

  // Bildirim olusturabilen kullanicilar foto/video yukleyebilir -> MinIO
  @RequirePermissions('REPORT_CREATE_ACCIDENT', 'REPORT_CREATE_NEARMISS')
  @Post()
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_BYTES },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_TYPES.includes(file.mimetype)) cb(null, true);
        else
          cb(
            new BadRequestException(
              'Desteklenmeyen dosya türü. Yalnızca fotoğraf (JPEG, PNG, WEBP, GIF, HEIC) veya video (MP4, WEBM, MOV) yükleyebilirsiniz.',
            ),
            false,
          );
      },
    }),
  )
  async upload(@UploadedFiles() files: Array<Express.Multer.File>) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Dosya bulunamadı.');
    }

    // Tip bazli boyut kontrolu (frontend'deki kontrolun sunucu tarafi karsiligi).
    for (const f of files) {
      const isVideo = ALLOWED_VIDEO_TYPES.includes(f.mimetype);
      const limit = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
      if (f.size > limit) {
        throw new BadRequestException(
          `"${f.originalname}" dosyası çok büyük. ${
            isVideo ? 'Video' : 'Fotoğraf'
          } için en fazla ${mb(limit)} MB yükleyebilirsiniz.`,
        );
      }
    }

    const urls: string[] = [];
    for (const f of files) {
      const key = await this.storage.put(f.buffer, f.originalname, f.mimetype);
      // Global prefix '/api' dahil -> client dogrudan bu yolu kullanir
      urls.push(`/api/files/${key}`);
    }
    return { urls };
  }
}
