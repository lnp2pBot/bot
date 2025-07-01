import { Community } from '../models';
import { ICommunity } from '../models/community';
import { UserDocument } from '../models/user';
import { logger } from '../logger';
import { Chat } from 'telegraf/typings/core/types/typegram';

interface CommunityLookupResult {
  community: ICommunity | null;
  communityId: string | undefined;
  isBanned: boolean;
}

/**
 * Optimized community lookup that combines multiple checks into a single database query
 * This reduces the number of database calls during order creation
 */
export const getCommunityInfo = async (
  user: UserDocument,
  chatType: string,
  chat?: Chat.UserNameChat
): Promise<CommunityLookupResult> => {
  try {
    let community: ICommunity | null = null;
    let communityId: string | undefined = undefined;

    // Determine community based on context
    if (chatType !== 'private' && chat?.username) {
      // Group chat - find community by group name
      const regex = new RegExp(`^@${chat.username}$`, 'i');
      community = await Community.findOne({ group: regex });
      if (community) {
        communityId = community._id;
      }
    } else if (user.default_community_id) {
      // Private chat with default community
      communityId = user.default_community_id;
      community = await Community.findById(communityId);
      
      // If community not found, clear the user's default
      if (!community) {
        user.default_community_id = undefined;
        await user.save();
        communityId = undefined;
      }
    }

    // Check if user is banned (only if community exists)
    let isBanned = false;
    if (community && communityId) {
      isBanned = community.banned_users.some((buser: any) => buser.id == user._id);
    }

    return {
      community,
      communityId,
      isBanned
    };
  } catch (error) {
    logger.error(`Error in getCommunityInfo: ${error}`);
    return {
      community: null,
      communityId: undefined,
      isBanned: false
    };
  }
};

/**
 * Check if a currency is supported by a community
 */
export const isCurrencySupported = (community: ICommunity | null, fiatCode: string): boolean => {
  if (!community) return true; // No community restriction
  return community.currencies.includes(fiatCode);
};