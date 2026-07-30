# Kommunity

Kommunity is a privacy-first platform where people participate in communities,
focused groups, and time-bounded events.

## Identity and access

**User**:
A person with one account and one or more role assignments. `user` is also the
baseline role for regular participation.
_Avoid_: Account, member when referring to the person

**Role assignment**:
A role granted to a user at platform, community, or event scope. One user may
hold several role assignments at the same time.
_Avoid_: User type, single role

**Root**:
The platform-wide administrator with authority over access control and all
platform resources.
_Avoid_: Global admin, owner

**Maintainer**:
A platform-wide operator responsible for maintenance, safety, and support
without ownership authority.
_Avoid_: Platform admin

**Super admin**:
The primary owner of one community. The role does not grant authority in other
communities or across the platform.
_Avoid_: Root, platform owner

**Admin**:
An administrator of one community with delegated community-management
authority.
_Avoid_: Super admin, moderator

**Presenter**:
A role scoped to one event that permits management of that event's presentation
details.
_Avoid_: Organizer, speaker

**Community member**:
A user participating in a specific community. Membership is separate from role
assignment.
_Avoid_: User when the community relationship is what matters
