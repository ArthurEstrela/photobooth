import { Processor, Process, InjectQueue } from '@nestjs/bull';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bull';
import { GenerateInvoicesUseCase } from '../use-cases/generate-invoices.use-case';
import { CheckOverdueInvoicesUseCase } from '../use-cases/check-overdue-invoices.use-case';

@Processor('subscription-billing')
@Injectable()
export class SubscriptionBillingProcessor implements OnModuleInit {
  private readonly logger = new Logger(SubscriptionBillingProcessor.name);

  constructor(
    @InjectQueue('subscription-billing') private readonly queue: Queue,
    private readonly generateInvoices: GenerateInvoicesUseCase,
    private readonly checkOverdue: CheckOverdueInvoicesUseCase,
  ) {}

  async onModuleInit() {
    const jobs = await this.queue.getRepeatableJobs();
    if (!jobs.find((j) => j.name === 'generate-invoices')) {
      await this.queue.add('generate-invoices', {}, { repeat: { cron: '0 0 * * *' } });
      this.logger.log('Scheduled generate-invoices cron job (0 0 * * *)');
    }
    if (!jobs.find((j) => j.name === 'check-overdue')) {
      await this.queue.add('check-overdue', {}, { repeat: { cron: '0 9 * * *' } });
      this.logger.log('Scheduled check-overdue cron job (0 9 * * *)');
    }
  }

  @Process('generate-invoices')
  async handleGenerateInvoices(_job: Job) {
    this.logger.log('Running generate-invoices job');
    await this.generateInvoices.execute();
  }

  @Process('check-overdue')
  async handleCheckOverdue(_job: Job) {
    this.logger.log('Running check-overdue job');
    await this.checkOverdue.execute();
  }
}
