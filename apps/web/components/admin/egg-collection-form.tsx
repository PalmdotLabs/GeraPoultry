'use client';

import { useCallback, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ApiClientError } from '@poultry/api-client';
import {
  countCollectedEggs,
  eggsPerTray,
  recordEggCollectionRequestSchema,
  type FarmSetupRecord,
  type FlockList,
} from '@poultry/validation';
import { adminApi } from './admin-api';
import {
  AdminErrorState,
  AdminForbiddenState,
  AdminLoadingState,
} from './admin-states';
import { useAdminApiErrors, useAdminData } from './use-admin-data';

const path = '/egg-collections/new';
const qualities = {
  good: 'Good eggs',
  cracked: 'Cracked or broken eggs',
  dirty: 'Dirty or stained eggs',
} as const;
const qualityKeys = ['good', 'cracked', 'dirty'] as const;
type Quality = (typeof qualityKeys)[number];
type DraftQuantity = { trays: string; looseEggs: string };
const emptyQuantities: Record<Quality, DraftQuantity> = {
  good: { trays: '', looseEggs: '' },
  cracked: { trays: '', looseEggs: '' },
  dirty: { trays: '', looseEggs: '' },
};

function countInput({ trays, looseEggs }: DraftQuantity) {
  return { trays: Number(trays), looseEggs: Number(looseEggs) };
}

function loadSetup(signal: AbortSignal) {
  return Promise.all([
    adminApi.listFarmSetup('sheds', { signal }),
    adminApi.listFarmSetup('egg-grades', { signal }),
  ]);
}

async function loadFlocks(signal: AbortSignal) {
  const flocks: FlockList['flocks'] = [];
  for (let page = 1; ; page++) {
    const result = await adminApi.listFlocks({ page, perPage: 100, signal });
    flocks.push(...result.flocks);
    if (flocks.length >= result.total || result.flocks.length === 0)
      return flocks;
  }
}

export function EggCollectionForm({
  canReadFlocks,
  canManageSetup,
}: {
  canReadFlocks: boolean;
  canManageSetup: boolean;
}) {
  const setup = useAdminData(loadSetup, path);
  const loadChoices = useCallback(
    (signal: AbortSignal) =>
      canReadFlocks ? loadFlocks(signal) : Promise.resolve([]),
    [canReadFlocks],
  );
  const flocks = useAdminData(loadChoices, path);

  if (setup.terminalStatus === 'forbidden')
    return <AdminForbiddenState permission="farm.setup.read" />;
  if (
    setup.terminalStatus === 'redirecting' ||
    flocks.terminalStatus === 'redirecting'
  )
    return <AdminLoadingState title="Returning to sign in" redirecting />;
  if (setup.loading)
    return <AdminLoadingState title="Loading sheds and egg grades" />;
  if (setup.error || !setup.data) {
    return (
      <AdminErrorState
        title="Could not load farm setup"
        message={setup.error ?? 'Try loading sheds and grades again.'}
        onRetry={setup.reload}
      />
    );
  }
  const [sheds, grades] = setup.data;
  if (!sheds.length || !grades.length) {
    return (
      <section className="admin-panel admin-form-panel">
        <h2>Farm setup needed</h2>
        <p>
          Add at least one shed and one egg grade before recording a collection.
        </p>
        {canManageSetup ? (
          <Link className="button button-primary" href="/farm-setup">
            Go to farm setup
          </Link>
        ) : (
          <p>Ask an administrator to complete farm setup.</p>
        )}
      </section>
    );
  }

  return (
    <div className="admin-detail-stack">
      {flocks.error && flocks.terminalStatus === null && (
        <AdminErrorState
          title="Could not load flocks"
          message="You can still record the collection against a shed."
          onRetry={flocks.reload}
        />
      )}
      <EggCollectionFields
        sheds={sheds}
        grades={grades}
        flocks={flocks.data ?? []}
        flockLoading={flocks.loading && canReadFlocks}
      />
    </div>
  );
}

function EggCollectionFields({
  sheds,
  grades,
  flocks,
  flockLoading,
}: {
  sheds: FarmSetupRecord[];
  grades: FarmSetupRecord[];
  flocks: FlockList['flocks'];
  flockLoading: boolean;
}) {
  const [shedId, setShedId] = useState('');
  const [flockId, setFlockId] = useState('');
  const [quantities, setQuantities] = useState(emptyQuantities);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attempt = useRef<{ payload: string; id: string } | null>(null);
  const { handleError, terminalStatus } = useAdminApiErrors(path);
  const choices = flocks.filter((flock) =>
    flock.placements.some((placement) => placement.shedId === shedId),
  );
  const total = qualityKeys.reduce(
    (sum, quality) => sum + countCollectedEggs(countInput(quantities[quality])),
    0,
  );

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    setSaved(false);
    const form = event.currentTarget;
    const fields = new FormData(form);
    const input = recordEggCollectionRequestSchema.safeParse({
      collectionDate: fields.get('collectionDate'),
      shedId,
      gradeId: fields.get('gradeId'),
      flockId: flockId || null,
      shift: fields.get('shift'),
      good: countInput(quantities.good),
      cracked: countInput(quantities.cracked),
      dirty: countInput(quantities.dirty),
      submissionId: attempt.current?.id ?? crypto.randomUUID(),
    });
    if (!input.success) {
      setError(
        'Check the date, shift, and egg counts. Enter whole, non-negative quantities.',
      );
      return;
    }

    const { submissionId, good, cracked, dirty, ...details } = input.data;
    const payload = JSON.stringify([
      details,
      countCollectedEggs(good),
      countCollectedEggs(cracked),
      countCollectedEggs(dirty),
    ]);
    const id =
      attempt.current && attempt.current.payload !== payload
        ? crypto.randomUUID()
        : submissionId;
    attempt.current = { payload, id };
    setPending(true);
    try {
      await adminApi.recordEggCollection({
        ...details,
        good,
        cracked,
        dirty,
        submissionId: id,
      });
      attempt.current = null;
      form.reset();
      setShedId('');
      setFlockId('');
      setQuantities(emptyQuantities);
      setSaved(true);
    } catch (caught) {
      if (
        caught instanceof ApiClientError &&
        (caught.status === null ||
          caught.status >= 500 ||
          caught.code === 'INVALID_RESPONSE')
      ) {
        setError('Could not confirm the save. Retry with the same details.');
      } else {
        setError(
          handleError(caught, 'Could not record the collection. Try again.', {
            source: 'mutation',
          }),
        );
      }
    } finally {
      setPending(false);
    }
  }

  if (terminalStatus === 'redirecting')
    return <AdminLoadingState title="Returning to sign in" redirecting />;
  return (
    <section className="admin-panel admin-form-panel">
      {saved && (
        <p className="form-message form-success" role="status">
          Egg collection recorded.{' '}
          <Link href="/egg-collections">View collections</Link>
        </p>
      )}
      <form
        className="admin-form"
        method="post"
        onSubmit={save}
        onChange={() => {
          setError(null);
          setSaved(false);
        }}
      >
        {error && (
          <p className="form-message form-error" role="alert">
            {error}
          </p>
        )}
        <fieldset className="flock-form-section" disabled={pending}>
          <legend>Collection details</legend>
          <div className="flock-fields">
            <div className="field">
              <label htmlFor="egg-date">Collection date</label>
              <input id="egg-date" name="collectionDate" type="date" required />
            </div>
            <div className="field">
              <label htmlFor="egg-shift">Shift</label>
              <input
                id="egg-shift"
                name="shift"
                required
                maxLength={80}
                autoComplete="off"
              />
            </div>
            <div className="field">
              <label htmlFor="egg-shed">Shed</label>
              <select
                id="egg-shed"
                required
                value={shedId}
                onChange={(event) => {
                  setShedId(event.target.value);
                  setFlockId('');
                }}
              >
                <option value="" disabled>
                  Choose a shed
                </option>
                {sheds.map(({ id, name }) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="egg-grade">Egg grade</label>
              <select id="egg-grade" name="gradeId" required defaultValue="">
                <option value="" disabled>
                  Choose a grade
                </option>
                {grades.map(({ id, name }) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            {(choices.length > 0 || flockLoading) && (
              <div className="field">
                <label htmlFor="egg-flock">Flock (optional)</label>
                <select
                  id="egg-flock"
                  value={flockId}
                  disabled={flockLoading}
                  onChange={(event) => setFlockId(event.target.value)}
                >
                  <option value="">
                    {flockLoading ? 'Loading flocks…' : 'Record against shed'}
                  </option>
                  {choices.map(({ id, batchCode }) => (
                    <option key={id} value={id}>
                      {batchCode}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </fieldset>
        <fieldset
          className="flock-form-section"
          disabled={pending}
          aria-describedby="egg-tray-size"
        >
          <legend>Egg counts</legend>
          <p id="egg-tray-size" className="field-hint">
            One tray holds {eggsPerTray} eggs. Blank counts are recorded as
            zero.
          </p>
          {qualityKeys.map((quality) => (
            <fieldset className="flock-form-section egg-quality" key={quality}>
              <legend>{qualities[quality]}</legend>
              <div className="flock-fields">
                {(['trays', 'looseEggs'] as const).map((key) => {
                  const id = `egg-${quality}-${key}`;
                  const label = key === 'trays' ? 'Trays' : 'Loose eggs';
                  return (
                    <div className="field" key={key}>
                      <label htmlFor={id}>
                        {label}
                        <span className="sr-only">
                          {' '}
                          for {qualities[quality].toLowerCase()}
                        </span>
                      </label>
                      <input
                        id={id}
                        type="number"
                        min={0}
                        step={1}
                        value={quantities[quality][key]}
                        onChange={(event) => {
                          const value = event.target.value;
                          setQuantities((current) => ({
                            ...current,
                            [quality]: { ...current[quality], [key]: value },
                          }));
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </fieldset>
          ))}
          <p className="egg-total" role="status">
            {total.toLocaleString('en-IN')} total eggs
          </p>
        </fieldset>
        <div className="admin-form-actions">
          <button
            className="button button-primary"
            type="submit"
            disabled={pending}
          >
            {pending ? 'Saving…' : 'Record collection'}
          </button>
        </div>
      </form>
    </section>
  );
}
