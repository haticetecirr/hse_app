import {
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Public } from '../common/decorators/permissions.decorator';
import { StorageService } from '../storage/storage.service';

// Yuklenen dosyalari MinIO'dan sunar. Herkese acik (img/video src ile erisim).
@Controller('files')
export class FilesController {
  constructor(private storage: StorageService) {}

  @Public()
  @Get(':key')
  async serve(
    @Param('key') key: string,
    @Headers('range') range: string | undefined,
    @Req() _req: Request,
    @Res() res: Response,
  ) {
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
      });

      const stream = await this.storage.getPartialStream(key, start, chunkSize);
      stream.pipe(res);
      return;
    }

    res.writeHead(200, {
      'Content-Length': size,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=86400',
    });
    const stream = await this.storage.getStream(key);
    stream.pipe(res);
  }
}
