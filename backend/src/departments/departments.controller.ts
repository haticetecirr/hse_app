import {
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { IsOptional, IsString, Length } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';

class DepartmentDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  @Length(3, 3, { message: 'Birim kodu 3 karakter olmali.' })
  code?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

@Controller('departments')
export class DepartmentsController {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  // Onaylı kullanicilar birim listesini gorebilir (bildirim olustururken lazim)
  @Get()
  findAll() {
    return this.prisma.department.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { members: true, reports: true } } },
    });
  }

  @RequirePermissions('DEPARTMENT_MANAGE')
  @Post()
  async create(
    @Body() dto: DepartmentDto,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    const dep = await this.prisma.department.create({ data: dto });
    await this.audit.log({
      actor: user,
      action: 'DEPARTMENT_CREATE',
      entityType: 'Department',
      entityId: dep.id,
      summary: `Birim olusturuldu: ${dep.name}`,
      ip,
    });
    return dep;
  }

  @RequirePermissions('DEPARTMENT_MANAGE')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: DepartmentDto) {
    const dep = await this.prisma.department.findUnique({ where: { id } });
    if (!dep) throw new NotFoundException('Birim bulunamadi.');
    return this.prisma.department.update({ where: { id }, data: dto });
  }

  @RequirePermissions('DEPARTMENT_MANAGE')
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    const dep = await this.prisma.department.findUnique({ where: { id } });
    if (!dep) throw new NotFoundException('Birim bulunamadi.');
    await this.prisma.department.delete({ where: { id } });
    await this.audit.log({
      actor: user,
      action: 'DEPARTMENT_DELETE',
      entityType: 'Department',
      entityId: id,
      summary: `Birim silindi: ${dep.name}`,
      ip,
    });
    return { ok: true };
  }
}
