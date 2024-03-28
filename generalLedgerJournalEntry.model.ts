import {
  DoubleEntryAccountingGuard,
  IGuard,
  ISourceTransaction,
  Model,
  Monetary,
  Polarity,
  ProjectJournalEntry,
  Result,
  UniqueId,
  filterEntryAmountsByPolarity,
} from '@modernfinops/shared'
import { groupBy, mapValues } from 'lodash'
import {
  IGeneralLedgerJournalEntry,
  GeneralLedgerJournalEntryProps,
  GeneralLedgerJournalEntryLineItem,
} from './IGeneralLedgerJournalEntry.model'

const SingleSourceTransactionGuard: IGuard<ProjectJournalEntry[]> = {
  validate(projectJournalEntries: ProjectJournalEntry[]) {
    const sourceTransactionIds = new Set(
      projectJournalEntries.map((projectJournalEntry) =>
        projectJournalEntry.props.sourceTransaction.id.toString(),
      ),
    )

    if (sourceTransactionIds.size === 1) {
      return Result.ok<ProjectJournalEntry[]>(projectJournalEntries)
    }

    return Result.fail<ProjectJournalEntry[]>(
      new Error(
        `The provided Project Journal Entries do not share the same Source Transaction.`,
      ),
    )
  },
}

const SourceTransactionMatchGuard: IGuard<GeneralLedgerJournalEntry> = {
  validate(generalLedgerJournalEntry: GeneralLedgerJournalEntry) {
    const sourceTransactionAmount =
      generalLedgerJournalEntry.sourceTransaction.amount
    const debitAmounts = filterEntryAmountsByPolarity(
      generalLedgerJournalEntry.lineItems,
      Polarity.DEBIT,
    )

    if (sourceTransactionAmount.equals(Monetary.sum(debitAmounts))) {
      return Result.ok<GeneralLedgerJournalEntry>(generalLedgerJournalEntry)
    }

    return Result.fail<GeneralLedgerJournalEntry>(
      new Error(
        `The total amount of Line Items do not match the Source Transaction, which will prevent the General Ledger Journal Entry from matching in Quickbooks.`,
      ),
    )
  },
}

export class GeneralLedgerJournalEntry
  extends Model<GeneralLedgerJournalEntryProps>
  implements IGeneralLedgerJournalEntry
{
  private constructor(
    public readonly sourceTransaction: ISourceTransaction,
    public readonly lineItems: GeneralLedgerJournalEntryLineItem[],
    props: GeneralLedgerJournalEntryProps,
    id?: UniqueId,
  ) {
    super(props, id)
  }

  public static create(
    props: GeneralLedgerJournalEntryProps,
    id?: UniqueId,
  ): Result<GeneralLedgerJournalEntry> {
    const singleSourceTransactionGuardResult =
      SingleSourceTransactionGuard.validate(props.projectJournalEntries)
    if (singleSourceTransactionGuardResult.error) {
      return Result.fail<GeneralLedgerJournalEntry>(
        singleSourceTransactionGuardResult.error,
      )
    }

    const { sourceTransaction } = props.projectJournalEntries[0].props

    const lineItems = GeneralLedgerJournalEntry.createLineItems(
      props.projectJournalEntries,
    )
    const guardResult = DoubleEntryAccountingGuard.validate(lineItems)
    if (guardResult.error) {
      return Result.fail<GeneralLedgerJournalEntry>(guardResult.error)
    }

    const generalLedgerJournalEntry = new GeneralLedgerJournalEntry(
      sourceTransaction,
      lineItems,
      props,
      id,
    )

    const sourceTransactionMatchGuardResult =
      SourceTransactionMatchGuard.validate(generalLedgerJournalEntry)

    if (sourceTransactionMatchGuardResult.error) {
      return sourceTransactionMatchGuardResult
    }

    return Result.ok<GeneralLedgerJournalEntry>(generalLedgerJournalEntry)
  }

  private static createLineItems(projectJournalEntries: ProjectJournalEntry[]) {
    // Extract all the Entries from within Project Journal Entries
    const entries = projectJournalEntries.flatMap(
      (projectJournalEntry) => projectJournalEntry.props.entries,
    )

    // Split Entries into Debits and Credits to make summing easier later
    const debitsAndCredits = {
      debits: entries.filter((entry) => entry.polarity === Polarity.DEBIT),
      credits: entries.filter((entry) => entry.polarity === Polarity.CREDIT),
    }

    const debitsAndCreditsGroupedByGeneralLedgerAccount = mapValues(
      debitsAndCredits,
      (entriesByPolarity) =>
        groupBy(entriesByPolarity, (entry) =>
          entry.props.account.businessAccount.id.toString(),
        ),
    )

    // Construct Line Items from Groups of Debits and Credits
    const lineItems: GeneralLedgerJournalEntryLineItem[] = Object.values(
      debitsAndCreditsGroupedByGeneralLedgerAccount,
    ).flatMap((groupedByGeneralLedgerAccount) =>
      Object.entries(groupedByGeneralLedgerAccount).map(
        ([generalLedgerAccountId, entriesGroups]) => {
          const { polarity } = entriesGroups[0].props
          const amount = Monetary.sum(
            entriesGroups.map((entry) => entry.amount),
          )
          const description = [
            ...new Set(entriesGroups.map((entry) => entry.props.account.name)),
          ].join(', ')
          return {
            generalLedgerAccountId: UniqueId.create(generalLedgerAccountId),
            amount,
            polarity,
            description,
          }
        },
      ),
    )

    return lineItems
  }
}
