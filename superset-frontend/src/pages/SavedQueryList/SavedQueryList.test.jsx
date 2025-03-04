/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import thunk from 'redux-thunk';
import * as reactRedux from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import configureStore from 'redux-mock-store';
import fetchMock from 'fetch-mock';
import { styledMount as mount } from 'spec/helpers/theming';
import {
  act,
  cleanup,
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { QueryParamProvider } from 'use-query-params';
import { isFeatureEnabled } from '@superset-ui/core';
import SavedQueryList from 'src/pages/SavedQueryList';
import SubMenu from 'src/features/home/SubMenu';
import ListView from 'src/components/ListView';
import Filters from 'src/components/ListView/Filters';
import ActionsBar from 'src/components/ListView/ActionsBar';
import DeleteModal from 'src/components/DeleteModal';
import Button from 'src/components/Button';
import IndeterminateCheckbox from 'src/components/IndeterminateCheckbox';
import waitForComponentToPaint from 'spec/helpers/waitForComponentToPaint';

const queriesInfoEndpoint = 'glob:*/api/v1/saved_query/_info*';
const queriesEndpoint = 'glob:*/api/v1/saved_query/?*';
const queryEndpoint = 'glob:*/api/v1/saved_query/*';
const queriesRelatedEndpoint = 'glob:*/api/v1/saved_query/related/database?*';
const queriesDistinctEndpoint = 'glob:*/api/v1/saved_query/distinct/schema?*';

const mockqueries = [...new Array(3)].map((_, i) => ({
  created_by: {
    id: i,
    first_name: `user`,
    last_name: `${i}`,
  },
  created_on: `${i}-2020`,
  database: {
    database_name: `db ${i}`,
    id: i,
  },
  changed_on_delta_humanized: '1 day ago',
  db_id: i,
  description: `SQL for ${i}`,
  id: i,
  label: `query ${i}`,
  schema: 'public',
  sql: `SELECT ${i} FROM table`,
  sql_tables: [
    {
      catalog: null,
      schema: null,
      table: `${i}`,
    },
  ],
}));

const user = {
  createdOn: '2021-04-27T18:12:38.952304',
  email: 'admin',
  firstName: 'admin',
  isActive: true,
  lastName: 'admin',
  permissions: {},
  roles: {
    Admin: [
      ['can_sqllab', 'Superset'],
      ['can_write', 'Dashboard'],
      ['can_write', 'Chart'],
    ],
  },
  userId: 1,
  username: 'admin',
};

// store needed for withToasts(DatabaseList)
const mockStore = configureStore([thunk]);
const store = mockStore({ user });

const useSelectorMock = jest.spyOn(reactRedux, 'useSelector');

// ---------- For import testing ----------
// Create an one more mocked query than the original mocked query array
const mockOneMoreQuery = [...new Array(mockqueries.length + 1)].map((_, i) => ({
  created_by: {
    id: i,
    first_name: `user`,
    last_name: `${i}`,
  },
  created_on: `${i}-2020`,
  database: {
    database_name: `db ${i}`,
    id: i,
  },
  changed_on_delta_humanized: '1 day ago',
  db_id: i,
  description: `SQL for ${i}`,
  id: i,
  label: `query ${i}`,
  schema: 'public',
  sql: `SELECT ${i} FROM table`,
  sql_tables: [
    {
      catalog: null,
      schema: null,
      table: `${i}`,
    },
  ],
}));
// Grab the last mocked query, to mock import
const mockNewImportQuery = mockOneMoreQuery.pop();
// Create a new file out of mocked import query to mock upload
const mockImportFile = new File(
  [mockNewImportQuery],
  'saved_query_import_mock.json',
);

fetchMock.get(queriesInfoEndpoint, {
  permissions: ['can_write', 'can_read', 'can_export'],
});
fetchMock.get(queriesEndpoint, {
  result: mockqueries,
  count: 3,
});

fetchMock.delete(queryEndpoint, {});
fetchMock.delete(queriesEndpoint, {});

fetchMock.get(queriesRelatedEndpoint, {
  count: 0,
  result: [],
});

fetchMock.get(queriesDistinctEndpoint, {
  count: 0,
  result: [],
});

// Mock utils module
jest.mock('src/views/CRUD/utils');

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

describe('SavedQueryList', () => {
  const wrapper = mount(
    <reactRedux.Provider store={store}>
      <SavedQueryList />
    </reactRedux.Provider>,
  );

  beforeEach(() => {
    // setup a DOM element as a render target
    useSelectorMock.mockClear();
  });

  beforeAll(async () => {
    await waitForComponentToPaint(wrapper);
  });

  it('renders', () => {
    expect(wrapper.find(SavedQueryList)).toBeTruthy();
  });

  it('renders a SubMenu', () => {
    expect(wrapper.find(SubMenu)).toBeTruthy();
  });

  it('renders a SubMenu with Saved queries and Query History links', () => {
    expect(wrapper.find(SubMenu).props().tabs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Saved queries' }),
        expect.objectContaining({ label: 'Query history' }),
      ]),
    );
  });

  it('renders a SubMenu without Databases and Datasets links', () => {
    expect(wrapper.find(SubMenu).props().tabs).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Databases' }),
        expect.objectContaining({ label: 'Datasets' }),
      ]),
    );
  });

  it('renders a ListView', () => {
    expect(wrapper.find(ListView)).toBeTruthy();
  });

  it('fetches saved queries', () => {
    const callsQ = fetchMock.calls(/saved_query\/\?q/);
    expect(callsQ).toHaveLength(1);
    expect(callsQ[0][0]).toMatchInlineSnapshot(
      `"http://localhost/api/v1/saved_query/?q=(order_column:changed_on_delta_humanized,order_direction:desc,page:0,page_size:25)"`,
    );
  });

  it('renders ActionsBar in table', () => {
    expect(wrapper.find(ActionsBar)).toBeTruthy();
    expect(wrapper.find(ActionsBar)).toHaveLength(3);
  });

  it('deletes', async () => {
    act(() => {
      wrapper.find('span[data-test="delete-action"]').first().props().onClick();
    });
    await waitForComponentToPaint(wrapper);

    expect(
      wrapper.find(DeleteModal).first().props().description,
    ).toMatchInlineSnapshot(
      `"This action will permanently delete the saved query."`,
    );

    act(() => {
      wrapper
        .find('#delete')
        .first()
        .props()
        .onChange({ target: { value: 'DELETE' } });
    });
    await waitForComponentToPaint(wrapper);
    act(() => {
      wrapper.find('button').last().props().onClick();
    });

    await waitForComponentToPaint(wrapper);

    expect(fetchMock.calls(/saved_query\/0/, 'DELETE')).toHaveLength(1);
  });

  it('copies a query link when the API succeeds', async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn(),
      },
    });

    fetchMock.get('glob:*/api/v1/saved_query', {
      result: [
        {
          id: 1,
          label: 'Test Query',
          db_id: 1,
          schema: 'public',
          sql: 'SELECT * FROM table',
        },
      ],
      count: 1,
    });
    fetchMock.post('glob:*/api/v1/sqllab/permalink', {
      body: { url: 'http://example.com/permalink' },
      status: 200,
    });

    render(
      <BrowserRouter>
        <QueryParamProvider>
          <SavedQueryList />
        </QueryParamProvider>
      </BrowserRouter>,
      { store },
    );

    const copyActionButton = await waitFor(
      () => screen.getAllByTestId('copy-action')[0],
    );
    userEvent.hover(copyActionButton);

    userEvent.click(copyActionButton);
    await waitFor(() => {
      expect(fetchMock.calls('glob:*/api/v1/sqllab/permalink').length).toBe(1);
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'http://example.com/permalink',
    );
  });

  it('shows/hides bulk actions when bulk actions is clicked', async () => {
    const button = wrapper.find(Button).at(0);
    act(() => {
      button.props().onClick();
    });
    await waitForComponentToPaint(wrapper);
    expect(wrapper.find(IndeterminateCheckbox)).toHaveLength(
      mockqueries.length + 1, // 1 for each row and 1 for select all
    );
  });

  it('searches', async () => {
    const filtersWrapper = wrapper.find(Filters);
    act(() => {
      filtersWrapper.find('[name="label"]').first().props().onSubmit('fooo');
    });
    await waitForComponentToPaint(wrapper);

    expect(fetchMock.lastCall()[0]).toMatchInlineSnapshot(
      `"http://localhost/api/v1/saved_query/?q=(filters:!((col:label,opr:all_text,value:fooo)),order_column:changed_on_delta_humanized,order_direction:desc,page:0,page_size:25)"`,
    );
  });
});

describe('RTL', () => {
  function renderAndWait() {
    return render(<SavedQueryList />, {
      useRedux: true,
      useRouter: true,
      useQueryParams: true,
    });
  }

  beforeEach(async () => {
    isFeatureEnabled.mockImplementation(() => true);
    renderAndWait();
  });

  afterEach(() => {
    cleanup();
    isFeatureEnabled.mockRestore();
  });
  it('renders an export button in the bulk actions', async () => {
    const bulkSelectButton = screen.getByRole('button', {
      name: /bulk select/i,
    });
    userEvent.click(bulkSelectButton);
    const checkbox = await screen.findByTestId('header-toggle-all');
    userEvent.click(checkbox);

    const exportButton = screen.getByRole('button', {
      name: /export/i,
    });
    expect(exportButton).toBeVisible();
  });

  it('renders an export button in the actions bar', async () => {
    // Grab Export action button and mock mouse hovering over it
    const exportActionButton = screen.getAllByTestId('export-action')[0];
    userEvent.hover(exportActionButton);

    // Wait for the tooltip to pop up
    await screen.findByRole('tooltip');

    // Grab and assert that "Export Query" tooltip is in the document
    const exportTooltip = screen.getByRole('tooltip', {
      name: /export query/i,
    });
    expect(exportTooltip).toBeInTheDocument();
  });

  it('renders a copy button in the actions bar', async () => {
    // Grab copy action button and mock mouse hovering over it
    const copyActionButton = screen.getAllByTestId('copy-action')[0];
    userEvent.hover(copyActionButton);

    // Wait for the tooltip to pop up
    await screen.findByRole('tooltip');

    // Grab and assert that "Copy query URl" tooltip is in the document
    const copyTooltip = screen.getByRole('tooltip', {
      name: /Copy query URL/i,
    });
    expect(copyTooltip).toBeInTheDocument();
  });

  it('renders an import button in the submenu', async () => {
    // Grab and assert that import saved query button is visible
    const importButton = await screen.findByTestId('import-button');
    expect(importButton).toBeVisible();
  });

  it('renders an "Import Saved Query" tooltip under import button', async () => {
    const importButton = await screen.findByTestId('import-icon');
    userEvent.hover(importButton);

    const importTooltip = await screen.findByRole('tooltip', {
      name: 'Import queries',
    });
    expect(importTooltip).toBeInTheDocument();
  });

  it('renders an import modal when import button is clicked', async () => {
    // Grab and click import saved query button to reveal modal
    expect(
      screen.queryByRole('heading', { name: 'Import queries' }),
    ).not.toBeInTheDocument();
    const importButton = await screen.findByTestId('import-button');
    userEvent.click(importButton);

    // Grab and assert that saved query import modal's heading is visible
    const importSavedQueryModalHeading = screen.getByRole('heading', {
      name: 'Import queries',
    });
    expect(importSavedQueryModalHeading).toBeInTheDocument();
  });

  it('imports a saved query', async () => {
    // Grab and click import saved query button to reveal modal
    const importButton = await screen.findByTestId('import-button');
    userEvent.click(importButton);

    // Grab "Choose File" input from import modal
    const chooseFileInput = screen.getByTestId('model-file-input');
    // Upload mocked import file
    userEvent.upload(chooseFileInput, mockImportFile);

    expect(chooseFileInput.files[0]).toStrictEqual(mockImportFile);
    expect(chooseFileInput.files.item(0)).toStrictEqual(mockImportFile);
    expect(chooseFileInput.files).toHaveLength(1);
  });
});
