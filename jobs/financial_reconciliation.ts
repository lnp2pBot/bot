import { Telegraf } from 'telegraf';
import { calculateFinancialStats, getFeesByCommunity } from '../util/financial';
import { Community } from '../models';
import { logger } from '../logger';
import { getChannelBalance } from 'lightning';
import lnd from '../ln/connect';
import { CommunityContext } from '../bot/modules/community/communityContext';

/**
 * Format a number with thousands separators
 */
const formatNumber = (num: number): string => {
  return num.toLocaleString('en-US');
};

/**
 * Format a percentage with 2 decimal places and escape for MarkdownV2
 */
const formatPercentage = (num: number): string => {
  return num.toFixed(2).replace(/\./g, '\\.');
};

/**
 * Escape date string for MarkdownV2 format
 */
const escapeDate = (date: Date): string => {
  return date.toISOString().split('T')[0].replace(/-/g, '\\-');
};

/**
 * Generate daily financial report and send it to admin channel
 */
const generateDailyFinancialReport = async (
  bot: Telegraf<CommunityContext>,
): Promise<void> => {
  try {
    const adminChannel = process.env.ADMIN_CHANNEL;
    if (!adminChannel) {
      logger.error('ADMIN_CHANNEL not configured');
      return;
    }

    // Calculate statistics for last 24 hours
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    logger.info(
      `Generating financial report for last 24 hours (${last24Hours.toISOString()} to ${now.toISOString()})`,
    );

    const stats = await calculateFinancialStats(last24Hours, now);
    const communityFees = await getFeesByCommunity(last24Hours, now);

    // Get node balance (channel balance)
    let nodeBalance = 0;
    let nodeBalanceStatus = '❌ No disponible';
    try {
      const balanceInfo = await getChannelBalance({ lnd });
      if (balanceInfo && balanceInfo.channel_balance !== undefined) {
        nodeBalance = balanceInfo.channel_balance;
        nodeBalanceStatus = `${formatNumber(nodeBalance)} sats`;
      }
    } catch (error) {
      logger.error(`Error getting node balance: ${error}`);
    }

    // Build node balance section (informational only)
    const nodeBalanceSection = `⚖️ *BALANCE DEL NODO*
└─ Balance actual: ${nodeBalanceStatus}`;

    // Build communities breakdown
    let communitiesSection = '';
    if (communityFees.length > 0) {
      const topCommunities = communityFees.slice(0, 5);
      const communityLines: string[] = [];

      for (const cf of topCommunities) {
        const community = await Community.findById(cf._id);
        const communityName = community ? community.name : cf._id;
        communityLines.push(
          `    │  ├─ ${communityName}: ${formatNumber(cf.communityFeesAllocated)} sats \\(${cf.totalOrders} órdenes\\)`,
        );
      }

      const totalCommunities = communityFees.length;
      if (totalCommunities > 5) {
        communityLines.push(
          `    │  └─ \\.\\.\\. y ${totalCommunities - 5} comunidades más`,
        );
      }

      communitiesSection = `\n    │\n${communityLines.join('\n')}`;
    }

    // Detailed breakdown of bot fees
    const botFeesFromNonCommunity =
      stats.ordersWithoutCommunity > 0
        ? `    ├─ Órdenes sin comunidad: ${formatNumber(Math.round(stats.botFeesEarned * (stats.ordersWithoutCommunity / stats.totalOrders)))} sats \\(${stats.ordersWithoutCommunity} órdenes\\)\n`
        : '';
    const botFeesFromCommunity =
      stats.ordersWithCommunity > 0
        ? `    ├─ Órdenes con comunidad: ${formatNumber(Math.round(stats.botFeesEarned * (stats.ordersWithCommunity / stats.totalOrders)))} sats \\(${stats.ordersWithCommunity} órdenes\\)\n`
        : '';
    const goldenHoneyBadgerNote =
      stats.goldenHoneyBadgerOrders > 0
        ? `    └─ Golden Honey Badger: 0 sats \\(${stats.goldenHoneyBadgerOrders} órdenes\\)\n`
        : '';

    // Build report message
    const message = `📊 *REPORTE FINANCIERO DIARIO*
━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 Período: Últimas 24 horas

💰 *INGRESOS POR FEES*
├─ Órdenes completadas: ${stats.totalOrders}
├─ Fee total cobrado: ${formatNumber(stats.totalFees)} sats
│
├─ 📦 Bot fees \\(~30%\\): ${formatNumber(stats.botFeesEarned)} sats
${botFeesFromNonCommunity}${botFeesFromCommunity}${goldenHoneyBadgerNote}│
└─ 🏘️ Community fees \\(~70%\\): ${formatNumber(stats.communityFeesAllocated)} sats
    └─ Distribuido a ${communityFees.length} comunidades${communitiesSection}

💸 *COSTOS OPERATIVOS*
└─ Routing fees pagados: ${formatNumber(stats.routingFeesPaid)} sats
    ├─ Promedio por orden: ${formatNumber(stats.averageRoutingFee)} sats
    ├─ % del monto transaccionado: ${formatPercentage(stats.routingFeePercentage / 100)}%
    └─ % de los fees cobrados: ${formatPercentage(stats.routingFeePercentage)}%

💵 *GANANCIA NETA DEL BOT*
└─ ${formatNumber(stats.netProfit)} sats \\(bot\\_fees \\- routing\\_fees\\)

${nodeBalanceSection}

📈 *MÉTRICAS ADICIONALES*
├─ Fee\\/orden promedio: ${formatNumber(stats.averageFeePerOrder)} sats
├─ Routing fee\\/pago: ${formatNumber(stats.averageRoutingFee)} sats
└─ Eficiencia operativa: ${formatPercentage(stats.operationalEfficiency)}%

_Generado automáticamente por el sistema de monitoreo financiero_`;

    // Send message to admin channel
    await bot.telegram.sendMessage(adminChannel, message, {
      parse_mode: 'MarkdownV2',
    });

    logger.info('Daily financial report sent successfully');

    // Send alert if routing fees are too high
    const routingFeeAlertThreshold = parseFloat(
      process.env.RECONCILIATION_ALERT_THRESHOLD || '0.02',
    );
    if (stats.routingFeePercentage > routingFeeAlertThreshold * 100) {
      const alertMessage = `⚠️ *ALERTA: ROUTING FEES ELEVADOS*

Los routing fees están en ${formatPercentage(stats.routingFeePercentage)}% de los fees cobrados, superando el umbral de ${formatPercentage(routingFeeAlertThreshold * 100)}%\\.

Recomendaciones:
• Revisar las rutas de pago del nodo
• Verificar la liquidez de los canales
• Considerar abrir canales directos con nodos frecuentes`;

      await bot.telegram.sendMessage(adminChannel, alertMessage, {
        parse_mode: 'MarkdownV2',
      });
    }
  } catch (error) {
    const errorMessage = String(error);
    logger.error(`Error generating daily financial report: ${errorMessage}`);

    // Try to send error notification
    try {
      const adminChannel = process.env.ADMIN_CHANNEL;
      if (adminChannel) {
        await bot.telegram.sendMessage(
          adminChannel,
          `❌ Error generando reporte financiero diario: ${errorMessage}`,
        );
      }
    } catch (notifError) {
      logger.error(`Failed to send error notification: ${notifError}`);
    }
  }
};

export default generateDailyFinancialReport;
