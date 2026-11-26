'use client';

import { useCallback, useRef, useState, type FormEvent } from 'react';
import { ApiClientError } from '@poultry/api-client';
import {
  recordFlockMortalityRequestSchema,
  type FlockLiveCounts,
} from '@poultry/validation';
import { adminApi } from './admin-api';
import {
  AdminErrorState,
  AdminForbiddenState,
  AdminLoadingState,
} from './admin-states';
import { useAdminData } from './use-admin-data';

type Placement = FlockLiveCounts['placements'][number];

export function FlockMortalityScreen({
  flockId,
  canRecord,
  canReadSetup,
}: {
  flockId: string;
  canRecord: boolean;
  canReadSetup: boolean;
}) {
  const path = `/flocks/${flockId}/mortality`;
  const loadCounts = useCallback(
    (signal: AbortSignal) => adminApi.getFlockLiveCounts(flockId, { signal }),
    [flockId],
  );
  const loadSheds = useCallback(
    (signal: AbortSignal) =>
      canReadSetup
        ? adminApi.listFarmSetup('sheds', { signal })
        : Promise.resolve([]),
    [canReadSetup],
  );
  const counts = useAdminData(loadCounts, path);
  const sheds = useAdminData(loadSheds, path);
  const [shedId, setShedId] = useState('');
  const [pending, setPending] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const attempt = useRef<{ payload: string; id: string } | null>(null);

  const names = new Map(sheds.data?.map(({ id, name }) => [id, name]));
  const placements = counts.data?.placements ?? [];
  const selected = placements.find((placement) => placement.shedId === shedId);
  const title = (id: string) => names.get(id) ?? id;

  async function record(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || counts.loading || !selected) return;
    setSaveError(null);
    setSaved(false);

    const form = event.currentTarget;
    const fields = new FormData(form);
    const input = recordFlockMortalityRequestSchema.safeParse({
      shedId: selected.shedId,
      recordedDate: fields.get('recordedDate'),
      birdCount: Number(fields.get('birdCount')),
      remarks: fields.get('remarks'),
      submissionId: attempt.current?.id ?? crypto.randomUUID(),
    });
    if (!input.success) {
      setSaveError('Check the date, bird count, and remarks.');
      return;
    }

    const { submissionId, ...details } = input.data;
    const payload = JSON.stringify(details);
    const id =
      attempt.current && attempt.current.payload !== payload
        ? crypto.randomUUID()
        : submissionId;
    attempt.current = { payload, id };
    setPending(true);
    try {
      await adminApi.recordFlockMortality(flockId, {
        ...details,
        submissionId: id,
      });
      attempt.current = null;
      form.reset();
      setShedId('');
      setSaved(true);
      counts.reload();
    } catch (caught) {
      if (
        caught instanceof ApiClientError &&
        (caught.status === null ||
          caught.status >= 500 ||
          caught.code === 'INVALID_RESPONSE')
      ) {
        setSaveError(
          'Could not confirm the save. Retry with the same details.',
        );
      } else {
        setSaveError(
          counts.handleError(caught, 'Could not record mortality. Try again.', {
            source: 'mutation',
          }),
        );
        if (caught instanceof ApiClientError && caught.status === 409)
          counts.reload();
      }
    } finally {
      setPending(false);
    }
  }

  if (counts.terminalStatus === 'forbidden')
    return <AdminForbiddenState permission="flocks.read" />;
  if (counts.terminalStatus === 'redirecting')
    return <AdminLoadingState title="Returning to sign in" redirecting />;

  return (
    <div className="admin-detail-stack">
      {saved && (
        <p className="form-message form-success" role="status">
          Mortality recorded.
        </p>
      )}
      {counts.loading && !counts.data && (
        <AdminLoadingState title="Loading live bird counts" />
      )}
      {counts.error && (
        <AdminErrorState
          title="Could not load bird counts"
          message={counts.error}
          onRetry={counts.reload}
        />
      )}
      {counts.data && (
        <section
          className="admin-panel"
          aria-labelledby="flock-counts-heading"
          aria-busy={counts.loading}
        >
          <div className="admin-panel-heading">
            <h2 id="flock-counts-heading">Live bird counts</h2>
          </div>
          {sheds.error && sheds.terminalStatus === null && (
            <AdminErrorState
              title="Could not load shed names"
              message="Showing shed IDs."
              onRetry={sheds.reload}
            />
          )}
          <div className="admin-table-wrap">
            <table className="admin-table flock-counts-table">
              <caption className="sr-only">
                Original placements and current bird counts by shed
              </caption>
              <thead>
                <tr>
                  <th scope="col">Shed</th>
                  <th scope="col">Initially placed</th>
                  <th scope="col">Live birds</th>
                </tr>
              </thead>
              <tbody>
                {placements.map(
                  ({ shedId: id, initialBirdCount, liveBirdCount }) => (
                    <tr key={id}>
                      <th scope="row">{title(id)}</th>
                      <td>{initialBirdCount.toLocaleString('en-IN')}</td>
                      <td>{liveBirdCount.toLocaleString('en-IN')}</td>
                    </tr>
                  ),
                )}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Total</th>
                  <td>{total(placements, 'initialBirdCount')}</td>
                  <td>{total(placements, 'liveBirdCount')}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {canRecord && counts.data && (
        <section
          className="admin-panel admin-form-panel"
          aria-labelledby="mortality-form-heading"
        >
          <div className="admin-panel-heading">
            <h2 id="mortality-form-heading">Record mortality</h2>
          </div>
          <form
            className="admin-form"
            method="post"
            onSubmit={record}
            onChange={() => {
              setSaveError(null);
              setSaved(false);
            }}
          >
            {saveError && (
              <p className="form-message form-error" role="alert">
                {saveError}
              </p>
            )}
            <fieldset
              className="flock-form-section"
              disabled={pending || counts.loading}
            >
              <legend className="sr-only">Mortality details</legend>
              <div className="flock-fields">
                <div className="field">
                  <label htmlFor="mortality-shed">Shed</label>
                  <select
                    id="mortality-shed"
                    required
                    value={shedId}
                    onChange={(event) => setShedId(event.target.value)}
                    aria-describedby={
                      selected ? 'mortality-available' : undefined
                    }
                  >
                    <option value="" disabled>
                      Choose a shed
                    </option>
                    {placements.map(({ shedId: id }) => (
                      <option key={id} value={id}>
                        {title(id)}
                      </option>
                    ))}
                  </select>
                  {selected && (
                    <p id="mortality-available" className="field-hint">
                      {selected.liveBirdCount.toLocaleString('en-IN')} live
                      birds in this shed
                    </p>
                  )}
                </div>
                <div className="field">
                  <label htmlFor="mortality-date">Recorded date</label>
                  <input
                    id="mortality-date"
                    name="recordedDate"
                    type="date"
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="mortality-count">Birds lost</label>
                  <input
                    id="mortality-count"
                    name="birdCount"
                    type="number"
                    min={1}
                    max={2147483647}
                    step={1}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="mortality-remarks">Remarks (optional)</label>
                  <textarea
                    id="mortality-remarks"
                    name="remarks"
                    maxLength={500}
                    rows={2}
                  />
                </div>
              </div>
            </fieldset>
            <div className="admin-form-actions">
              <button
                className="button button-primary"
                type="submit"
                disabled={pending || counts.loading}
              >
                {pending ? 'Saving…' : 'Record mortality'}
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}

function total(
  placements: Placement[],
  field: 'initialBirdCount' | 'liveBirdCount',
) {
  return placements
    .reduce((count, placement) => count + placement[field], 0)
    .toLocaleString('en-IN');
}
