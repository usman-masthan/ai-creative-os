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

- `ACTIVE` — may be inserted, versioned and used as an upgrade target.
- `DEPRECATED` — existing instances remain valid, but new insertion/version creation is blocked until reactivated.
- `ARCHIVED` — retained for audit/history, but new insertion/version creation is blocked until reactivated.
- changing status never mutates an existing design or component instance.

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

After detach, the block is ordinary native DesignDocument content and cannot be upgraded through the component lifecycle path unless it is saved again as a new component family.

## Persistence

Immutable component definitions are stored under:

```text
.atthas-os/components/<clientId>/<brandId>/<componentId>.json
```

Family lifecycle records are stored separately under:

```text
.atthas-os/components/<clientId>/<brandId>/_families/<familyId>.json
```

This keeps mutable lifecycle state separate from immutable component definitions.

## Studio routes

```text
GET  /api/studio/components?designId=<designId>
POST /api/studio/components/create
POST /api/studio/components/version
POST /api/studio/components/status
POST /api/studio/components/instantiate
POST /api/studio/components/upgrade
POST /api/studio/components/detach
```

Create, instantiate and upgrade routes resolve the campaign's immutable task truth from the existing AI trace. Insert, upgrade and detach each save exactly one new DesignDocument version and rerun deterministic QA where design content/provenance changes.

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
- Refresh Library

The browser shows family status, latest version, selected version, truth dependencies and selected-instance version information. Server-side validation remains authoritative even if the browser is bypassed.

## Cost model

Saving, listing, lifecycle management, versioning, inserting, upgrading and detaching reusable components are deterministic operations and add **zero AI/model calls**.

## Lifecycle state machine

```text
Selected native group
→ source text/name/asset stripping
→ immutable component family v1
→ ACTIVE
   ├─ duplicate as immutable vN+1
   ├─ explicit insert after destination truth validation
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
```

## Non-goals for this phase

This is intentionally not:

- a cross-brand template marketplace;
- a cross-client component system;
- a reusable product-image library;
- a way to save factual copy as a template;
- nested components;
- automatic/live-linked master components that mutate existing instances;
- a background process that silently upgrades approved designs.

Those features require additional provenance and governance and must not be implemented by weakening destination truth checks or immutable version history.
