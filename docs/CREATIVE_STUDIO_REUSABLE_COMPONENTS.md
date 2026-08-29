# Creative Studio — Truth-Safe Reusable Components

## Purpose

Reusable components are composition primitives, not campaign-content templates.

The library exists to reuse layout structure, native typography styling and shape treatment without allowing facts, product imagery, prices, offers or other campaign-specific content to leak from one confirmed task into another.

## Safety boundary

A reusable component is scoped to one `clientId + brandId`.

Version 1 admits only:

- native text-layer style/geometry slots
- native shape layers
- group composition structure

Version 1 rejects:

- image layers
- logos
- backgrounds
- masks
- nested groups
- locked children
- children participating in mask semantics

This means the reusable-component store cannot become an alternate asset library or a way to carry stale product imagery between campaigns.

## Source-content stripping

When a group is saved as a reusable component:

1. source text payloads are not persisted;
2. source layer display names are replaced with semantic template labels;
3. text roles are retained (`headline`, `supporting`, `cta`, `price`, `body`, `disclaimer`, `brand-identifier`);
4. typography/style/geometry are retained;
5. shape geometry/style are retained;
6. detected confirmed-truth dependencies are recorded as truth keys;
7. source campaign/truth/design provenance is retained for audit only.

A component therefore stores style and structure, not publishable campaign copy.

## Truth dependency detection

`price` text slots always require confirmed destination `price` truth.

For all text roles, scalar values found in the source confirmed task snapshot are detected inside source text before the text is stripped. Matching fact keys are recorded in `requiredTruthKeys`.

Examples can include:

- `productName`
- `price`
- `offerTerms`
- `offerValidity`
- branch/contact/address values
- campaign dates
- other task-confirmed scalar facts that are visibly present

The component does not retain those source values.

## Destination insertion

Insertion requires:

- exact client match;
- exact brand match;
- an `ACTIVE` component family;
- destination DesignDocument bound to the destination confirmed task snapshot;
- valid confirmation provenance;
- every recorded `requiredTruthKey` present in destination task truth;
- exactly one native destination text layer for each text role used by the component.

Text is reconstructed from the destination design's native role layer. The source campaign's text is never reused.

For example, a component saved from:

```text
headline → Chicken Tikka Wrap
price → Rs. 1,250
```

can be inserted into another confirmed campaign only if that destination has the required truth and native text roles. The inserted component receives the destination campaign's current headline and price text, not `Chicken Tikka Wrap` or `Rs. 1,250`.

## Cross-format behavior

Component geometry is stored relative to its source group and source artboard.

On insertion:

- a uniform scale derives from source vs destination artboard size;
- relative typography and shape metrics scale with the block;
- the source group's relative artboard position is reused;
- the block is translated back inside the destination artboard if necessary;
- protected stacking structure remains above/below the editable tier as before.

The component does not change the destination layout provider or artboard semantics.

## Provenance

Every inserted child and group carries:

```text
componentInstance.componentId
componentInstance.instanceId
componentInstance.templateLayerId
```

This metadata is audit provenance only. It does not drive factual content or renderer truth.

`componentId` points to one immutable component version. Existing instances therefore never need a mutable live-link pointer.

## Immutable family/version lifecycle

Reusable components are organized into component families.

A family record contains:

- `familyId`
- `clientId`
- `brandId`
- family display name
- lifecycle status
- contiguous immutable version records
- latest version/component pointer
- created/updated timestamps

The first component saved for a family is version 1. Older pre-lifecycle component files are migrated lazily as implicit version 1 families when the library is read.

Creating a new version never overwrites an older component definition. `Duplicate as New Version` creates a new immutable component file with the next contiguous version number and records which earlier component it was derived from.

Lifecycle status is mutable metadata separate from immutable component definitions:

```text
ACTIVE
DEPRECATED
ARCHIVED
```

Rules:

- `ACTIVE` — may be inserted, versioned, authored and used as an upgrade target.
- `DEPRECATED` — existing instances remain valid, but new insertion/version creation is blocked until reactivated.
- `ARCHIVED` — retained for audit/history, but new insertion/version creation is blocked until reactivated.
- changing status never mutates an existing design or component instance.

## Governed version authoring

A designer may intentionally turn an edited group into the next immutable version of an existing active family.

Authoring is a two-step operation:

```text
Preview → Explicit Publish
```

### Preview

Preview is read-only. It:

1. rebuilds a sanitized candidate component from the selected group and current confirmed task truth;
2. compares the candidate with the family's current latest immutable component;
3. computes structural and truth-dependency differences;
4. classifies compatibility;
5. returns a SHA-256 preview token bound to the design id/version, selected group, family latest version, diff and sanitized candidate structure.

The preview reports:

- template count before/after;
- text roles added/removed;
- text style or geometry changes;
- shape count and shape style/geometry changes;
- confirmed-truth dependencies added/removed;
- compatibility issues.

Compatibility states are:

```text
COMPATIBLE
REVIEW_REQUIRED
BLOCKED
```

`COMPATIBLE` means the semantic slot/truth contract is unchanged and the edit is structure/style/geometry compatible.

`REVIEW_REQUIRED` is used when text roles, shape-layer count or truth dependencies change. It does not mean the version is invalid; it means the user must explicitly acknowledge that downstream destination compatibility has changed.

`BLOCKED` is used when the family is not active, the preview base is no longer the family latest version, or the client/brand boundary does not match.

### Publish

Publish recomputes the candidate and preview on the server. It requires:

- the exact family latest component id returned by preview;
- the exact preview token returned by preview;
- the same current design version and selected group state represented by that token;
- mandatory version notes from 5 to 500 characters;
- explicit review acknowledgement when compatibility is `REVIEW_REQUIRED`;
- an `ACTIVE` family.

If the group or design changes after preview, publication fails with a stale-preview error and the user must preview again.

A successful publish:

1. writes a new immutable component definition using the next contiguous family version id;
2. advances only the family latest-version pointer;
3. stores authoring notes, compatibility state, diff and source design/truth provenance in an authoring audit record;
4. leaves every previous component definition unchanged;
5. leaves every existing DesignDocument and component instance unchanged;
6. adds zero AI/model calls.

Version authoring is therefore a **component-library mutation only**. It is not a hidden design edit or live-link update.

Authoring audit records are stored separately under:

```text
.atthas-os/components/<clientId>/<brandId>/_authoring/<familyId>.json
```

## Explicit instance upgrades

There are no automatic instance updates.

An upgrade is an explicit user action and must:

1. start from an attached component instance;
2. stay inside the same component family;
3. target a strictly newer immutable component version;
4. require the family to be `ACTIVE`;
5. rerun destination truth validation against the target component's truth dependencies;
6. rebuild text from destination native role layers;
7. preserve the existing instance's visual placement as closely as possible through proportional fit, rotation and center-position restoration;
8. replace the old instance in memory;
9. persist exactly one new DesignDocument revision;
10. rerun deterministic QA.

Placement-preservation transforms are calculated internally and are not saved as separate history versions.

This prevents a library edit from silently changing a reviewed or approved campaign design.

## Detach

Detach removes only `componentInstance` provenance from the selected instance's group and children.

It does not:

- delete layers;
- flatten content;
- rewrite text;
- remove group membership;
- invoke a model.

After detach, the block is ordinary native DesignDocument content and cannot be upgraded through the component lifecycle path unless it is saved again as a new component family or intentionally authored into an existing compatible family.

## Persistence

Immutable component definitions are stored under:

```text
.atthas-os/components/<clientId>/<brandId>/<componentId>.json
```

Family lifecycle records are stored separately under:

```text
.atthas-os/components/<clientId>/<brandId>/_families/<familyId>.json
```

Authoring notes/diffs are stored separately under:

```text
.atthas-os/components/<clientId>/<brandId>/_authoring/<familyId>.json
```

This keeps mutable lifecycle state and authoring audit metadata separate from immutable component definitions.

## Studio routes

```text
GET  /api/studio/components?designId=<designId>
GET  /api/studio/components/version-audit?designId=<designId>&familyId=<familyId>
POST /api/studio/components/create
POST /api/studio/components/version
POST /api/studio/components/status
POST /api/studio/components/instantiate
POST /api/studio/components/upgrade
POST /api/studio/components/detach
POST /api/studio/components/version-preview
POST /api/studio/components/publish-version
```

Create, instantiate, upgrade, preview and publish routes resolve the campaign's immutable task truth from the existing AI trace. Insert, upgrade and detach each save exactly one new DesignDocument version and rerun deterministic QA where design content/provenance changes. Preview and publish-authoring do not mutate the source DesignDocument.

## UI

The `/studio` Arrange panel exposes a component family/version browser with:

- Save Group as New Family
- family selector
- immutable version selector
- Insert Version
- Duplicate as New Version
- Deprecate
- Archive
- Reactivate
- Upgrade Selected Instance
- Detach Instance
- Preview Version Changes
- mandatory version-notes editor
- structural/truth-dependency diff preview
- Publish as Next Immutable Version
- authored version-note history
- Refresh Library

The browser shows family status, latest version, selected version, truth dependencies, selected-instance version information and authoring compatibility. Server-side validation remains authoritative even if the browser is bypassed.

## Cost model

Saving, listing, lifecycle management, versioning, previewing, publishing, inserting, upgrading and detaching reusable components are deterministic operations and add **zero AI/model calls**.

## Lifecycle and authoring state machine

```text
Selected native group
→ source text/name/asset stripping
→ immutable component family v1
→ ACTIVE
   ├─ duplicate as immutable vN+1
   ├─ explicit insert after destination truth validation
   ├─ preview edited group against latest version
   │  → structural + truth-dependency diff
   │  → COMPATIBLE / REVIEW_REQUIRED / BLOCKED
   │  → required notes + acknowledgement when needed
   │  → publish immutable vN+1
   │  → existing designs remain unchanged
   ├─ DEPRECATED
   └─ ARCHIVED

Attached instance vN
→ user explicitly chooses Upgrade
→ same-family newer version required
→ destination truth revalidated
→ destination native text rebound
→ placement preserved
→ one new DesignDocument revision + QA

Attached instance
→ Detach
→ remove component provenance only
→ ordinary native group/layers
→ may be edited and intentionally previewed/published as a new family version
```

## Non-goals for this phase

This is intentionally not:

- a cross-brand template marketplace;
- a cross-client component system;
- a reusable product-image library;
- a way to save factual copy as a template;
- nested components;
- automatic/live-linked master components that mutate existing instances;
- a background process that silently upgrades approved designs;
- an overwrite/edit operation on an existing immutable component version.

Those features require additional provenance and governance and must not be implemented by weakening destination truth checks, explicit authoring review or immutable version history.
