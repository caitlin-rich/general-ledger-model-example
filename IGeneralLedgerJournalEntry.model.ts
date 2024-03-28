import {
  ProjectJournalEntry,
  Model,
  UniqueId,
  IJournalEntryLineItem,
  ISourceTransaction,
} from '@modernfinops/shared'

export interface GeneralLedgerJournalEntryProps {
  projectJournalEntries: ProjectJournalEntry[]
}

export interface IGeneralLedgerJournalEntry
  extends Model<GeneralLedgerJournalEntryProps> {
  sourceTransaction: ISourceTransaction
  lineItems: GeneralLedgerJournalEntryLineItem[]
}

export interface GeneralLedgerJournalEntryLineItem
  extends IJournalEntryLineItem {
  generalLedgerAccountId: UniqueId
  description?: string
}
