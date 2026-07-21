export {};

const { expect } = require('chai');
const sinon = require('sinon');
const { Community } = require('../../models');
const { getCommunityByIdentifier } = require('../../util/communityHelper');

/**
 * Routing tests for getCommunityByIdentifier. They assert the resolved
 * community_id (not just parsed arguments) and, most importantly, the query
 * shape used for the display-name fallback:
 *  - the name is matched exactly (case-sensitive), so "Foo" and "foo" cannot be
 *    confused now that name has only a case-sensitive unique index;
 *  - the name fallback is restricted to public communities, so a private
 *    community can only be reached through its canonical group identifier.
 */
describe('getCommunityByIdentifier routing', () => {
  const user: any = { _id: 'user-1' };

  afterEach(() => sinon.restore());

  it('resolves by canonical group id (case-insensitive) for private communities', async () => {
    const community = {
      _id: 'community-private',
      public: false,
      banned_users: [],
    };
    const findOne = sinon.stub(Community, 'findOne');
    findOne.onFirstCall().resolves(community);

    const result = await getCommunityByIdentifier(user, '-1001234567890');

    expect(String(result.communityId)).to.equal('community-private');
    const groupQuery = findOne.firstCall.args[0];
    expect(groupQuery.group).to.be.an.instanceOf(RegExp);
    expect(groupQuery.group.flags).to.contain('i');
  });

  it('matches the display name exactly and only among public communities', async () => {
    const community = { _id: 'community-foo', public: true, banned_users: [] };
    const findOne = sinon.stub(Community, 'findOne');
    findOne.onFirstCall().resolves(null); // no group match
    findOne.onSecondCall().resolves(community); // name match

    const result = await getCommunityByIdentifier(user, 'foo');

    expect(String(result.communityId)).to.equal('community-foo');
    const nameQuery = findOne.secondCall.args[0];
    // case-sensitive exact string, not a case-insensitive regex
    expect(nameQuery.name).to.equal('foo');
    expect(nameQuery.name).to.not.be.an.instanceOf(RegExp);
    // never falls back into private communities by name
    expect(nameQuery.public).to.equal(true);
  });

  it('does not resolve a private community by its display name', async () => {
    const findOne = sinon.stub(Community, 'findOne');
    findOne.onFirstCall().resolves(null); // no group match
    // name fallback filters on public: true, so a private one is not returned
    findOne.onSecondCall().resolves(null);

    const result = await getCommunityByIdentifier(user, 'PrivateName');

    expect(result.community).to.equal(null);
    expect(result.communityId).to.equal(undefined);
  });
});
