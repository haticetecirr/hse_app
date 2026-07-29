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

@Controller('uploads')
export class UploadsController {
  constructor(private storage: StorageService) {}

  // Bildirim olusturabilen kullanicilar foto/video yukleyebilir -> MinIO
  @RequirePermissions('REPORT_CREATE_ACCIDENT', 'REPORT_CREATE_NEARMISS')
  @Post()
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: memoryStorage(),
      limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB (video icin)
      fileFilter: (_req, file, cb) => {
        if (/^(image|video)\//.test(file.mimetype)) cb(null, true);
        else
          cb(
            new BadRequestException('Sadece resim veya video yüklenebilir.'),
            false,
          );
      },
    }),
  )
  async upload(@UploadedFiles() files: Array<Express.Multer.File>) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Dosya bulunamadı.');
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
