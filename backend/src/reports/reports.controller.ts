import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { AuditService } from '../audit/audit.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import {
  AssignReportDto,
  CreateAccidentDto,
  CreateActionDto,
  CreateNearMissDto,
  UpdateStatusDto,
} from './dto/report.dto';

@Controller('reports')
export class ReportsController {
  constructor(
    private reports: ReportsService,
    private audit: AuditService,
  ) {}

  @RequirePermissions('DASHBOARD_VIEW', 'REPORT_VIEW_OWN')
  @Get('stats')
  stats(@CurrentUser() user: AuthUser) {
    return this.reports.stats(user);
  }

  @RequirePermissions('REPORT_CREATE_ACCIDENT')
  @Post('accident')
  async createAccident(
    @Body() dto: CreateAccidentDto,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    const r = await this.reports.createAccident(dto, user);
    await this.audit.log({
      actor: user,
      action: 'REPORT_CREATE',
      entityType: 'Report',
      entityId: r.id,
      summary: `İş kazası bildirimi oluşturuldu: ${r.referenceNo}`,
      ip,
    });
    return r;
  }

  @RequirePermissions('REPORT_CREATE_NEARMISS')
  @Post('near-miss')
  async createNearMiss(
    @Body() dto: CreateNearMissDto,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    const r = await this.reports.createNearMiss(dto, user);
    await this.audit.log({
      actor: user,
      action: 'REPORT_CREATE',
      entityType: 'Report',
      entityId: r.id,
      summary: `Ramak kala bildirimi oluşturuldu: ${r.referenceNo} (risk: ${r.riskLevel})`,
      ip,
    });
    return r;
  }

  @RequirePermissions(
    'REPORT_VIEW_OWN',
    'REPORT_VIEW_DEPARTMENT',
    'REPORT_VIEW_ALL',
  )
  @Get()
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.reports.findAll(user, { type, status, departmentId });
  }

  @RequirePermissions(
    'REPORT_VIEW_OWN',
    'REPORT_VIEW_DEPARTMENT',
    'REPORT_VIEW_ALL',
  )
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.reports.findOne(id, user);
  }

  @RequirePermissions('REPORT_INVESTIGATE', 'REPORT_CLOSE', 'REPORT_UPDATE')
  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    const r = await this.reports.updateStatus(id, dto, user);
    await this.audit.log({
      actor: user,
      action: 'REPORT_STATUS_CHANGE',
      entityType: 'Report',
      entityId: id,
      summary: `${r.referenceNo} durumu -> ${dto.status}`,
      ip,
    });
    return r;
  }

  @RequirePermissions('REPORT_ASSIGN')
  @Post(':id/assign')
  async assign(
    @Param('id') id: string,
    @Body() dto: AssignReportDto,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    const r = await this.reports.assign(id, dto, user);
    await this.audit.log({
      actor: user,
      action: 'REPORT_ASSIGN',
      entityType: 'Report',
      entityId: id,
      summary: `${r.referenceNo} bildirimi ${r.assignedTo?.firstName} ${r.assignedTo?.lastName} kişisine atandı`,
      ip,
    });
    return r;
  }

  @RequirePermissions('ACTION_MANAGE', 'REPORT_INVESTIGATE')
  @Post(':id/actions')
  async addAction(
    @Param('id') id: string,
    @Body() dto: CreateActionDto,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    const a = await this.reports.addAction(id, dto, user);
    await this.audit.log({
      actor: user,
      action: 'ACTION_CREATE',
      entityType: 'CorrectiveAction',
      entityId: a.id,
      summary: `Düzeltici faaliyet eklendi: ${dto.description}`,
      ip,
    });
    return a;
  }

  @RequirePermissions('ACTION_MANAGE', 'REPORT_INVESTIGATE')
  @Patch('actions/:actionId')
  async updateAction(
    @Param('actionId') actionId: string,
    @Body() body: { status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'VERIFIED' },
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    const a = await this.reports.updateActionStatus(actionId, body.status);
    await this.audit.log({
      actor: user,
      action: 'ACTION_STATUS_CHANGE',
      entityType: 'CorrectiveAction',
      entityId: actionId,
      summary: `Faaliyet durumu -> ${body.status}`,
      ip,
    });
    return a;
  }
}
