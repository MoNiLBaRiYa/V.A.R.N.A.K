import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

export interface AuditEventParams {
  userId?: string | null;
  eventType: string;
  resourceType: string;
  resourceId?: string | null;
  outcome: 'SUCCESS' | 'FAILURE' | 'DENIED' | 'ERROR';
  sourceIp?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function recordAuditEvent(params: AuditEventParams) {
  try {
    const record = await prisma.auditLog.create({
      data: {
        userId: params.userId ?? null,
        eventType: params.eventType,
        resourceType: params.resourceType,
        resourceId: params.resourceId ?? null,
        outcome: params.outcome,
        sourceIp: params.sourceIp ?? null,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      },
    });

    logger.info(
      {
        auditEventId: record.id,
        eventType: params.eventType,
        resourceType: params.resourceType,
        outcome: params.outcome,
        userId: params.userId,
      },
      `[AuditLog] ${params.eventType} ${params.outcome}`
    );

    return record;
  } catch (error) {
    logger.error({ error, eventParams: params }, '[AuditLog] Failed to record audit log entry');
    // Ensure audit failures do not silently break caller, but are logged
    throw error;
  }
}
