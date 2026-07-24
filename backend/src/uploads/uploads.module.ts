import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { FilesController } from './files.controller';

@Module({
  controllers: [UploadsController, FilesController],
})
export class UploadsModule {}
