import { Module } from '@nestjs/common';
import { BulkImportService } from './bulk-import.service';

@Module({
  providers: [BulkImportService],
  exports: [BulkImportService],
})
export class BulkImportModule {}
