import { Telegraf } from 'telegraf';
import { I18n } from '@grammyjs/i18n';
import { calculateFinancialStats, getFeesByCommunity } from '../util/financial';
import { Community } from '../models';
import { logger } from '../logger';
import { getChannelBalance } from 'lightning';
import lnd from '../ln/connect';
import { CommunityContext } from '../bot/modules/community/communityContext';
import * as path from 'path';

// Initialize i18n for admin reports (English by default)
const i18n = new I18n({
  defaultLanguageOnMissing: true,
  directory: path.resolve(__dirname, '../../locales'),
  useSession: false,
});

// Create context for 'en' locale
const t = i18n.t.bind(i18n);

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
 * Escape text for MarkdownV2
 */
const esc = (s: string): string => {
  return s.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
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
    let nodeBalanceStatus = `❌ ${t('en', 'financial_report_not_available')}`;
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
    const nodeBalanceSection = `⚖️ *${t('en', 'financial_report_node_balance')}*
└─ ${t('en', 'financial_report_current_balance')}: ${nodeBalanceStatus}`;

    // Build communities breakdown
    let communitiesSection = '';
    if (communityFees.length > 0) {
      const topCommunities = communityFees.slice(0, 5);
      const communityLines: string[] = [];

      for (const cf of topCommunities) {
        const community = await Community.findById(cf._id);
        const communityName = esc(community ? community.name : String(cf._id));
        communityLines.push(
          `    │  ├─ ${communityName}: ${formatNumber(
            cf.communityFeesAllocated,
          )} sats \\(${cf.totalOrders} ${t('en', 'orders').toLowerCase()}\\)`,
        );
      }
      const totalCommunities = communityFees.length;
      if (totalCommunities > 5) {
        communityLines.push(
          `    │  └─ ${t('en', 'financial_report_and_more_communities', { count: totalCommunities - 5 })}`,
        );
      }

      communitiesSection = `\n    │\n${communityLines.join('\n')}`;
    }

    // Detailed breakdown of bot fees
    const botFeesFromNonCommunity =
      stats.ordersWithoutCommunity > 0
        ? `    ├─ ${t('en', 'financial_report_orders_no_community')}: ${formatNumber(Math.round(stats.botFeesEarned * (stats.ordersWithoutCommunity / stats.totalOrders)))} sats \\(${stats.ordersWithoutCommunity} ${t('en', 'orders').toLowerCase()}\\)\n`
        : '';
    const botFeesFromCommunity =
      stats.ordersWithCommunity > 0
        ? `    ├─ ${t('en', 'financial_report_orders_with_community')}: ${formatNumber(Math.round(stats.botFeesEarned * (stats.ordersWithCommunity / stats.totalOrders)))} sats \\(${stats.ordersWithCommunity} ${t('en', 'orders').toLowerCase()}\\)\n`
        : '';
    const goldenHoneyBadgerNote =
      stats.goldenHoneyBadgerOrders > 0
        ? `    └─ ${t('en', 'financial_report_golden_honey_badger')}: 0 sats \\(${stats.goldenHoneyBadgerOrders} ${t('en', 'orders').toLowerCase()}\\)\n`
        : '';

    // Build report message
    const message = `📊 *${t('en', 'financial_report_title')}*
━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 ${t('en', 'financial_report_period_last_24h')}

💰 *${t('en', 'financial_report_fees_income')}*
├─ ${t('en', 'financial_report_orders_completed')}: ${stats.totalOrders}
├─ ${t('en', 'financial_report_total_fee')}: ${formatNumber(stats.totalFees)} sats
│
├─ 📦 ${t('en', 'financial_report_bot_fees')}: ${formatNumber(stats.botFeesEarned)} sats
${botFeesFromNonCommunity}${botFeesFromCommunity}${goldenHoneyBadgerNote}│
└─ 🏘️ ${t('en', 'financial_report_community_fees')}: ${formatNumber(stats.communityFeesAllocated)} sats
    └─ ${t('en', 'financial_report_distributed_to', { count: communityFees.length })}${communitiesSection}

💸 *${t('en', 'financial_report_operational_costs')}*
└─ ${t('en', 'financial_report_routing_fees')}: ${formatNumber(stats.routingFeesPaid)} sats
    ├─ ${t('en', 'financial_report_avg_per_order')}: ${formatNumber(stats.averageRoutingFee)} sats
    ├─ ${t('en', 'financial_report_pct_amount')}: ${formatPercentage(stats.routingFeePercentage / 100)}%
    └─ ${t('en', 'financial_report_pct_fees')}: ${formatPercentage(stats.routingFeePercentage)}%

💵 *${t('en', 'financial_report_net_profit')}*
└─ ${formatNumber(stats.netProfit)} sats \\(bot\\_fees \\- routing\\_fees\\)

${nodeBalanceSection}

📈 *${t('en', 'financial_report_additional_metrics')}*
├─ ${t('en', 'financial_report_avg_fee_per_order')}: ${formatNumber(stats.averageFeePerOrder)} sats
├─ ${t('en', 'financial_report_avg_routing_fee')}: ${formatNumber(stats.averageRoutingFee)} sats
└─ ${t('en', 'financial_report_operational_efficiency')}: ${formatPercentage(stats.operationalEfficiency)}%

_${t('en', 'financial_report_auto_generated')}_`;

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
      const alertMessage = `⚠️ *${t('en', 'financial_report_alert_title')}*

${t('en', 'financial_report_alert_message', {
  current: formatPercentage(stats.routingFeePercentage),
  threshold: formatPercentage(routingFeeAlertThreshold * 100),
})}\\.

${t('en', 'financial_report_alert_recommendations')}`;

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
          `❌ ${t('en', 'financial_report_error_generating', { error: errorMessage })}`,
        );
      }
    } catch (notifError) {
      logger.error(`Failed to send error notification: ${notifError}`);
    }
  }
};

export default generateDailyFinancialReport;
