// Proposals feature module barrel export
export {
  useProposals,
  useProposalPendingCount,
  useCreateProposal,
  useApproveProposal,
  useRejectProposal,
  proposalKeys,
} from './hooks/use-proposals';

// Components
export { ProposalForm } from './components/proposal-form';
export { ProposalList } from './components/proposal-list';
