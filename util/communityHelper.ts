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
  chat?: Chat.UserNameChat,
): Promise<CommunityLookupResult> => {
  try {
    let community: ICommunity | null = null;
    let communityId: string | undefined;

    // Determine community based on context
    if (chatType !== 'private' && chat?.username) {
      // Group chat - find community by group name
      const regex = new RegExp(`^@${chat.username}$`, 'i');
      community = await Community.findOne({
        group: regex,
        enabled: { $ne: false },
      });
      if (community) {
        communityId = community._id;
      }
    } else if (user.default_community_id) {
      // Private chat with default community
      communityId = user.default_community_id;
      community = await Community.findOne({
        _id: communityId,
        enabled: { $ne: false },
      });

      if (!community) {
        user.default_community_id = undefined;
        await user.save();
        communityId = undefined;
      }
    }

    // Check if user is banned (only if community exists)
    let isBanned = false;
    if (community && communityId) {
      isBanned = community.banned_users.some(
        (buser: any) => String(buser.id) === String(user._id),
      );
    }

    return {
      community,
      communityId,
      isBanned,
    };
  } catch (error) {
    logger.error(`Error in getCommunityInfo: ${error}`);
    return {
      community: null,
      communityId: undefined,
      isBanned: false,
    };
  }
};

/**
 * Look up an enabled community by the identifier the user typed. It first tries
 * the community group (the @handle or telegram group id, the same identifier
 * used by /setcomm), matched ignoring uppercase/lowercase since the group is
 * stored lowercase and unique. It then falls back to the display name, matched
 * exactly (case-sensitive) and restricted to public communities: the name is
 * only case-sensitively unique, so an exact match stays unambiguous, and
 * private communities can only be reached through their canonical group id.
 * Also reports whether the given user is banned from it.
 */
export const getCommunityByIdentifier = async (
  user: UserDocument,
  identifier: string,
): Promise<CommunityLookupResult> => {
  try {
    // Escape regex metacharacters so the identifier is matched literally
    const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const groupRegex = new RegExp(`^${escaped}$`, 'i');

    const community =
      (await Community.findOne({
        group: groupRegex,
        enabled: { $ne: false },
      })) ||
      (await Community.findOne({
        name: identifier,
        public: true,
        enabled: { $ne: false },
      }));

    if (!community) {
      return { community: null, communityId: undefined, isBanned: false };
    }

    const isBanned = community.banned_users.some(
      (buser: any) => String(buser.id) === String(user._id),
    );

    return { community, communityId: community._id, isBanned };
  } catch (error) {
    logger.error(`Error in getCommunityByIdentifier: ${error}`);
    return { community: null, communityId: undefined, isBanned: false };
  }
};

/**
 * Check if a currency is supported by a community
 */
export const isCurrencySupported = (
  community: ICommunity | null,
  fiatCode: string,
): boolean => {
  if (!community) return true; // No community restriction
  return community.currencies.includes(fiatCode);
};
