import {
  Entry,
  IBusinessAccount,
  IProject,
  IProjectAccount,
  ISourceTransaction,
  Monetary,
  ProjectJournalEntry,
  ProjectJournalEntryStatus,
  UniqueId,
} from '@modernfinops/shared'
import { mock, mockDeep } from 'jest-mock-extended'
import { GeneralLedgerJournalEntryProps } from '../IGeneralLedgerJournalEntry.model'
import { GeneralLedgerJournalEntry } from '../generalLedgerJournalEntry.model'

// Test Data Modeled after [this Example](https://www.notion.so/modernfinops/Save-Transactions-to-QuickBooks-ef214224696e460bb7d1d9adda409f92?pvs=4#47daf6f54a00480bb07b3cfbc1adc2d7)

const mockSourceTransaction = mock<ISourceTransaction>({
  id: 'mock-source-transaction-1',
})
mockSourceTransaction.amount = Monetary.createFromDollars(10000)

const mockGeneralLedgerAccountCogs = mockDeep<IBusinessAccount>({
  name: 'Construction Materials Costs (COGS)',
  id: 'test-general-ledger-account-cogs',
})

const mockGeneralLedgerAccountSubsExpense = mockDeep<IBusinessAccount>({
  id: 'test-general-ledger-account-subs-expense',
  name: 'Subcontractor Expense',
})

const mockGeneralLedgerAccountCash = mockDeep<IBusinessAccount>({
  id: 'test-general-ledger-account-cash',
  name: 'Checking',
})

const mockProjectAccountLumber = mock<IProjectAccount>({
  name: 'Lumber',
  businessAccount: mockGeneralLedgerAccountCogs,
})

const mockProjectAccountFramingLabor = mock<IProjectAccount>({
  name: 'Framing Labor',
  businessAccount: mockGeneralLedgerAccountSubsExpense,
})

const mockProjectAccountCash = mock<IProjectAccount>({
  name: 'Cash',
  businessAccount: mockGeneralLedgerAccountCash,
})

const testProjectJournalEntry1 = ProjectJournalEntry.create({
  project: mock<IProject>({
    id: 'test-project-a',
    name: 'Project A',
  }),
  entries: [
    Entry.debit({
      amount: Monetary.createFromDollars(3500),
      account: mockProjectAccountLumber,
    }),
    Entry.credit({
      amount: Monetary.createFromDollars(3500),
      account: mockProjectAccountCash,
    }),
  ],
  status: ProjectJournalEntryStatus.READY_TO_POST,
  sourceTransaction: mockSourceTransaction,
}).value

const testProjectJournalEntry2 = ProjectJournalEntry.create({
  project: mock<IProject>({
    id: 'test-project-a',
    name: 'Project A',
  }),
  entries: [
    Entry.debit({
      amount: Monetary.createFromDollars(3000),
      account: mockProjectAccountFramingLabor,
    }),
    Entry.credit({
      amount: Monetary.createFromDollars(3000),
      account: mockProjectAccountCash,
    }),
  ],
  status: ProjectJournalEntryStatus.READY_TO_POST,
  sourceTransaction: mockSourceTransaction,
}).value

const testProjectJournalEntry3 = ProjectJournalEntry.create({
  project: mock<IProject>({
    id: 'test-project-b',
    name: 'Project B',
  }),
  entries: [
    Entry.debit({
      amount: Monetary.createFromDollars(3500),
      account: mockProjectAccountLumber,
    }),
    Entry.credit({
      amount: Monetary.createFromDollars(3500),
      account: mockProjectAccountCash,
    }),
  ],
  status: ProjectJournalEntryStatus.READY_TO_POST,
  sourceTransaction: mockSourceTransaction,
}).value

describe('[Unit Test] General Ledger Journal Entry Model', () => {
  it('Create a General Ledger Journal Entry with Valid Inputs', () => {
    const generalLedgerJournalEntryProps: GeneralLedgerJournalEntryProps = {
      projectJournalEntries: [
        testProjectJournalEntry1,
        testProjectJournalEntry2,
        testProjectJournalEntry3,
      ],
    }

    const generalLedgerJournalEntryResult = GeneralLedgerJournalEntry.create(
      generalLedgerJournalEntryProps,
    )

    expect(generalLedgerJournalEntryResult.isSuccess).toBeTruthy()

    const generalLedgerJournalEntry = generalLedgerJournalEntryResult.value
    expect(generalLedgerJournalEntry.lineItems).toHaveLength(3) // The two General Ledger Accounts and Cash
    expect(
      generalLedgerJournalEntry.lineItems
        .find((lineItem) =>
          lineItem.generalLedgerAccountId.equals(
            UniqueId.create(mockGeneralLedgerAccountCogs.id.toString()),
          ),
        )
        ?.amount.equals(Monetary.createFromDollars(7000)),
    ).toBeTruthy()
    expect(
      generalLedgerJournalEntry.lineItems
        .find((lineItem) =>
          lineItem.generalLedgerAccountId.equals(
            UniqueId.create(mockGeneralLedgerAccountSubsExpense.id.toString()),
          ),
        )
        ?.amount.equals(Monetary.createFromDollars(3000)),
    ).toBeTruthy()
  })

  it('Should Fail with Multiple Source Transactions among Project Journal Entries', () => {
    const testProjectJournalEntryDifferentSourceTransaction =
      ProjectJournalEntry.create({
        ...testProjectJournalEntry3.props,
        sourceTransaction: mock<ISourceTransaction>({
          id: 'mock-source-transaction-2',
        }),
      }).value
    const generalLedgerJournalEntryProps: GeneralLedgerJournalEntryProps = {
      projectJournalEntries: [
        testProjectJournalEntry1,
        testProjectJournalEntry2,
        testProjectJournalEntryDifferentSourceTransaction,
      ],
    }

    const generalLedgerJournalEntryResult = GeneralLedgerJournalEntry.create(
      generalLedgerJournalEntryProps,
    )

    expect(generalLedgerJournalEntryResult.isSuccess).toBeFalsy()
  })

  it('Should Fail if General Ledger Journal Entry will not Match Source Transaction', () => {
    const generalLedgerJournalEntryProps: GeneralLedgerJournalEntryProps = {
      projectJournalEntries: [
        testProjectJournalEntry1,
        testProjectJournalEntry2,
      ],
    }

    const generalLedgerJournalEntryResult = GeneralLedgerJournalEntry.create(
      generalLedgerJournalEntryProps,
    )

    expect(generalLedgerJournalEntryResult.isSuccess).toBeFalsy()
  })
})
