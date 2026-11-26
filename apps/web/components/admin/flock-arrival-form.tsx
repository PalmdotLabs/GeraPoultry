'use client';

import { useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ApiClientError } from '@poultry/api-client';
import {
  createFlockRequestSchema,
  type CreateFlockRequest,
  type FarmSetupRecord,
} from '@poultry/validation';
import { adminApi } from './admin-api';
import {
  AdminErrorState,
  AdminForbiddenState,
  AdminLoadingState,
} from './admin-states';
import { useAdminApiErrors, useAdminData } from './use-admin-data';

const formPath = '/flocks/new';
const maxBirdCount = 2_147_483_647;
const emptyPlacement = { key: 0, shedId: '', birdCount: '' };

function loadFarmSetup(signal: AbortSignal) {
  return Promise.all([
    adminApi.listFarmSetup('breeds', { signal }),
    adminApi.listFarmSetup('sheds', { signal }),
  ]);
}

function asNumber(value: FormDataEntryValue | string | null) {
  return typeof value === 'string' && value.trim() ? Number(value) : NaN;
}

type PlacementDraft = typeof emptyPlacement;

export function FlockArrivalForm({
  canManageSetup,
}: {
  canManageSetup: boolean;
}) {
  const { data, error, loading, reload, terminalStatus } = useAdminData(
    loadFarmSetup,
    formPath,
  );

  if (terminalStatus === 'forbidden')
    return <AdminForbiddenState permission="farm.setup.read" />;
  if (terminalStatus === 'redirecting')
    return <AdminLoadingState title="Returning to sign in" redirecting />;
  if (loading) return <AdminLoadingState title="Loading breeds and sheds" />;
  if (error || !data) {
    return (
      <AdminErrorState
        title="Could not load breeds and sheds"
        message={error ?? 'Reload farm setup and try again.'}
        onRetry={reload}
      />
    );
  }

  const [breeds, sheds] = data;
  if (!breeds.length || !sheds.length) {
    return (
      <section className="admin-panel admin-form-panel">
        <h2>Farm setup needed</h2>
        <p>Add at least one breed and one shed before registering a flock.</p>
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
  return <ArrivalFields breeds={breeds} sheds={sheds} />;
}

function ArrivalFields({
  breeds,
  sheds,
}: {
  breeds: FarmSetupRecord[];
  sheds: FarmSetupRecord[];
}) {
  const [birdsHoused, setBirdsHoused] = useState('');
  const [placements, setPlacements] = useState<PlacementDraft[]>([
    emptyPlacement,
  ]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placementError, setPlacementError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const nextKey = useRef(1);
  const attempt = useRef<{ payload: string; id: string } | null>(null);
  const { handleError, terminalStatus } = useAdminApiErrors(formPath);
  const allocated = placements.reduce(
    (sum, row) => sum + (Number(row.birdCount) || 0),
    0,
  );
  const selectedSheds = new Set(placements.map(({ shedId }) => shedId));

  function resetFeedback() {
    setError(null);
    setPlacementError(null);
  }

  function updateRow(
    key: number,
    value: Partial<Pick<PlacementDraft, 'shedId' | 'birdCount'>>,
  ) {
    setPlacements((rows) =>
      rows.map((row) => (row.key === key ? { ...row, ...value } : row)),
    );
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || saved) return;
    resetFeedback();

    const form = new FormData(event.currentTarget);
    const withAttemptId = createFlockRequestSchema.safeParse({
      batchCode: form.get('batchCode'),
      breedId: form.get('breedId'),
      arrivalDate: form.get('arrivalDate'),
      ageAtArrival: asNumber(form.get('ageAtArrival')),
      ageUnit: form.get('ageUnit'),
      birdsHoused: asNumber(birdsHoused),
      placements: placements.map(({ shedId, birdCount }) => ({
        shedId,
        birdCount: asNumber(birdCount),
      })),
      submissionId: attempt.current?.id ?? crypto.randomUUID(),
    });
    if (!withAttemptId.success) {
      const issues = withAttemptId.error.issues;
      const splitIssue = issues.find(({ path }) => path[0] === 'placements');
      if (splitIssue) {
        setPlacementError(
          splitIssue.path.length === 1
            ? splitIssue.message
            : 'Choose a shed and enter a positive whole bird count for each placement.',
        );
      }
      if (issues.some(({ path }) => path[0] !== 'placements')) {
        setError('Check the batch ID, arrival date, and bird details.');
      }
      return;
    }

    const { submissionId, ...values } = withAttemptId.data;
    const payload = JSON.stringify({
      ...values,
      placements: [...values.placements].sort((left, right) =>
        left.shedId.localeCompare(right.shedId),
      ),
    });
    const current = attempt.current;
    const id =
      current && current.payload !== payload
        ? crypto.randomUUID()
        : submissionId;
    attempt.current = { payload, id };
    const input: CreateFlockRequest = { ...values, submissionId: id };
    setPending(true);
    try {
      await adminApi.createFlock(input);
      setSaved(input.batchCode);
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
          handleError(caught, 'Could not register the flock. Try again.', {
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
  if (saved) {
    return (
      <section className="admin-panel admin-form-panel">
        <p className="form-message form-success" role="status">
          Registered batch {saved}.
        </p>
        <div className="admin-form-actions">
          <Link className="button button-primary" href="/flocks">
            Go to flocks
          </Link>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => {
              attempt.current = null;
              setBirdsHoused('');
              setPlacements([emptyPlacement]);
              setSaved(null);
            }}
          >
            Register another flock
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="admin-panel admin-form-panel">
      <form
        className="admin-form flock-arrival-form"
        method="post"
        onSubmit={save}
        onChange={resetFeedback}
      >
        {error && (
          <p className="form-message form-error" role="alert">
            {error}
          </p>
        )}
        <fieldset className="flock-form-section" disabled={pending}>
          <legend>Batch details</legend>
          <div className="flock-fields">
            <div className="field">
              <label htmlFor="flock-batch-code">Batch ID</label>
              <input
                id="flock-batch-code"
                name="batchCode"
                required
                maxLength={120}
                autoComplete="off"
              />
            </div>
            <div className="field">
              <label htmlFor="flock-breed">Breed</label>
              <select id="flock-breed" name="breedId" required defaultValue="">
                <option value="" disabled>
                  Choose a breed
                </option>
                {breeds.map(({ id, name }) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="flock-arrival-date">Arrival date</label>
              <input
                id="flock-arrival-date"
                name="arrivalDate"
                type="date"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="flock-birds-housed">Birds housed</label>
              <input
                id="flock-birds-housed"
                name="birdsHoused"
                type="number"
                min={1}
                max={maxBirdCount}
                step={1}
                required
                value={birdsHoused}
                onChange={(event) => setBirdsHoused(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="flock-arrival-age">Age at arrival</label>
              <input
                id="flock-arrival-age"
                name="ageAtArrival"
                type="number"
                min={0}
                max={maxBirdCount}
                step={1}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="flock-age-unit">Age unit</label>
              <select id="flock-age-unit" name="ageUnit" defaultValue="days">
                <option value="days">Days</option>
                <option value="weeks">Weeks</option>
              </select>
            </div>
          </div>
        </fieldset>

        <fieldset
          className="flock-form-section flock-placements"
          disabled={pending}
          aria-describedby="flock-allocation-total"
        >
          <legend>Initial shed placement</legend>
          <p id="flock-allocation-total" className="field-hint" role="status">
            {allocated.toLocaleString('en-IN')}
            {birdsHoused &&
              ` of ${Number(birdsHoused).toLocaleString('en-IN')}`}{' '}
            birds allocated
          </p>
          {placements.map((row, index) => (
            <div className="flock-placement-row" key={row.key}>
              <div className="field">
                <label htmlFor={`flock-shed-${row.key}`}>
                  Shed {index + 1}
                </label>
                <select
                  id={`flock-shed-${row.key}`}
                  required
                  value={row.shedId}
                  onChange={(event) =>
                    updateRow(row.key, { shedId: event.target.value })
                  }
                >
                  <option value="" disabled>
                    Choose a shed
                  </option>
                  {sheds.map(({ id, name }) => (
                    <option
                      key={id}
                      value={id}
                      disabled={id !== row.shedId && selectedSheds.has(id)}
                    >
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor={`flock-count-${row.key}`}>
                  Birds in shed {index + 1}
                </label>
                <input
                  id={`flock-count-${row.key}`}
                  type="number"
                  min={1}
                  max={maxBirdCount}
                  step={1}
                  required
                  value={row.birdCount}
                  onChange={(event) =>
                    updateRow(row.key, { birdCount: event.target.value })
                  }
                />
              </div>
              {placements.length > 1 && (
                <button
                  className="button button-secondary"
                  type="button"
                  aria-label={`Remove shed placement ${index + 1}`}
                  onClick={() => {
                    resetFeedback();
                    setPlacements((rows) =>
                      rows.filter(({ key }) => key !== row.key),
                    );
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          {placementError && (
            <p className="form-message form-error" role="alert">
              {placementError}
            </p>
          )}
          {placements.length < sheds.length && (
            <button
              className="button button-secondary"
              type="button"
              onClick={() => {
                const key = nextKey.current++;
                resetFeedback();
                setPlacements((rows) => [
                  ...rows,
                  { key, shedId: '', birdCount: '' },
                ]);
              }}
            >
              Add a shed
            </button>
          )}
        </fieldset>

        <div className="admin-form-actions">
          <button
            className="button button-primary"
            type="submit"
            disabled={pending}
          >
            {pending ? 'Registering…' : 'Register flock'}
          </button>
        </div>
      </form>
    </section>
  );
}
