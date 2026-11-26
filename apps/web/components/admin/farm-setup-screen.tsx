'use client';

import { useCallback, useState, type FormEvent } from 'react';
import { ApiClientError } from '@poultry/api-client';
import { createFarmSetupRecordRequestSchema } from '@poultry/validation';
import { adminApi } from './admin-api';
import {
  AdminErrorState,
  AdminForbiddenState,
  AdminLoadingState,
} from './admin-states';
import { useAdminData } from './use-admin-data';

const labels = {
  sheds: { list: 'Sheds', record: 'shed', input: 'Shed name' },
  breeds: { list: 'Breeds', record: 'breed', input: 'Breed name' },
  'egg-grades': {
    list: 'Egg grades',
    record: 'egg grade',
    input: 'Egg grade name',
  },
};

function FarmSetupPanel({
  kind,
  canCreate,
}: {
  kind: keyof typeof labels;
  canCreate: boolean;
}) {
  const label = labels[kind];
  const load = useCallback(
    (signal: AbortSignal) => adminApi.listFarmSetup(kind, { signal }),
    [kind],
  );
  const { data, loading, error, terminalStatus, handleError, reload } =
    useAdminData(load, '/farm-setup');
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [invalidName, setInvalidName] = useState(false);
  const [savedName, setSavedName] = useState<string | null>(null);

  async function createRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || loading) return;

    const input = createFarmSetupRecordRequestSchema.safeParse({ name });
    setSavedName(null);
    setFormError(null);
    setInvalidName(false);
    if (!input.success) {
      setFormError('Enter a name between 1 and 120 characters.');
      setInvalidName(true);
      return;
    }

    setPending(true);
    try {
      const record = await adminApi.createFarmSetupRecord(kind, input.data);
      setName('');
      setSavedName(record.name);
      reload();
    } catch (caught) {
      if (caught instanceof ApiClientError && caught.code === 'CONFLICT') {
        setFormError(`A ${label.record} with that name already exists.`);
        setInvalidName(true);
      } else {
        setFormError(
          handleError(caught, `Could not add the ${label.record}. Try again.`, {
            source: 'mutation',
          }),
        );
      }
    } finally {
      setPending(false);
    }
  }

  const inputId = `farm-setup-${kind}-name`;
  const errorId = `${inputId}-error`;

  return (
    <section className="admin-panel" aria-labelledby={`${kind}-heading`}>
      <div className="admin-panel-heading">
        <h2 id={`${kind}-heading`}>{label.list}</h2>
      </div>

      {terminalStatus === 'forbidden' && (
        <AdminForbiddenState permission="farm.setup.read" />
      )}
      {terminalStatus === 'redirecting' && (
        <AdminLoadingState
          title="Your session has expired"
          description="Returning you to sign in."
          redirecting
        />
      )}
      {terminalStatus === null && (
        <>
          {loading && data === null && (
            <AdminLoadingState title={`Loading ${kind}`} />
          )}
          {error && (
            <AdminErrorState
              title={`Could not load ${kind}`}
              message={error}
              onRetry={reload}
            />
          )}
          {data && (
            <div aria-busy={loading}>
              {data.length > 0 ? (
                <ul className="farm-setup-list" aria-label={label.list}>
                  {data.map((record) => (
                    <li key={record.id}>{record.name}</li>
                  ))}
                </ul>
              ) : (
                <p className="admin-empty">No {kind} added yet.</p>
              )}
            </div>
          )}

          {canCreate && (data !== null || savedName !== null) && (
            <form
              className="admin-form farm-setup-form"
              method="post"
              onSubmit={createRecord}
            >
              <div className="field">
                <label htmlFor={inputId}>{label.input}</label>
                <input
                  id={inputId}
                  name="name"
                  type="text"
                  autoComplete="off"
                  required
                  maxLength={120}
                  value={name}
                  readOnly={pending || data === null}
                  aria-invalid={invalidName || undefined}
                  aria-describedby={invalidName ? errorId : undefined}
                  onChange={(event) => {
                    setName(event.target.value);
                    setFormError(null);
                    setInvalidName(false);
                    setSavedName(null);
                  }}
                />
              </div>
              {formError && (
                <p
                  id={errorId}
                  className="form-message form-error"
                  role="alert"
                >
                  {formError}
                </p>
              )}
              {savedName && (
                <p className="form-message form-success" role="status">
                  Added {savedName}.
                </p>
              )}
              <div className="admin-form-actions">
                <button
                  className="button button-primary"
                  type="submit"
                  disabled={pending || loading || data === null}
                >
                  {pending ? 'Adding…' : `Add ${label.record}`}
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </section>
  );
}

export function FarmSetupScreen({
  canCreate,
  showEggGrades,
}: {
  canCreate: boolean;
  showEggGrades: boolean;
}) {
  return (
    <div className="farm-setup-grid">
      <FarmSetupPanel kind="sheds" canCreate={canCreate} />
      <FarmSetupPanel kind="breeds" canCreate={canCreate} />
      {showEggGrades && (
        <FarmSetupPanel kind="egg-grades" canCreate={canCreate} />
      )}
    </div>
  );
}
