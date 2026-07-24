import { Controller, Get, Query } from '@nestjs/common';
import { AuditService } from './audit.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

@Controller('audit')
export class AuditController {
  constructor(private audit: AuditService) {}

  @RequirePermissions('AUDIT_VIEW')
  @Get()
  findAll(
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
  ) {
    return this.audit.findAll({ action, entityType });
  }
}
