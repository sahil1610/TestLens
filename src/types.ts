export type LikelyCause =
  | 'Backend Issue'
  | 'Client/Test Data Issue'
  | 'Flaky Test'
  | 'Test Issue'
  | 'Unknown';

export type Confidence = 'High' | 'Medium' | 'Low';

export type TestStatus = 'passed' | 'failed' | 'flaky' | 'skipped' | 'timedOut';

export type NetworkEvent = {
  url: string;
  method: string;
  status: number;
};

export type NetworkAggregate = {
  url: string;
  method: string;
  status: number;
  count: number;
};

export type TestNetworkSummary = {
  events: NetworkAggregate[];
};

export type ConsoleErrorEvent = {
  type: 'console' | 'pageerror';
  message: string;
  count: number;
};

export type TestConsoleSummary = {
  errors: ConsoleErrorEvent[];
};

export type CollectedTestFailure = {
  id: string;
  title: string;
  file?: string;
  status: TestStatus;
  retry: number;
  errorMessage?: string;
  durationMs: number;
  network?: TestNetworkSummary;
  console?: TestConsoleSummary;
};

export type FailureExplanation = {
  likelyCause: LikelyCause;
  reason: string;
  confidence: Confidence;
};

