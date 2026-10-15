export type RootStackParamList = {
  Login: undefined;
  FarmerLogin: undefined;
  FarmerHome: undefined;
  FarmerList: undefined;
  Dashboard: undefined;
  Staff: undefined;
  Batches: undefined;
  ChangePassword: undefined;
  Outbox: undefined;
  FarmerDetail: { farmerId: string; farmerName: string };
  // Optional: coming from FarmerDetail pre-selects the farmer. Coming from the
  // list's "Record Receipt" button leaves it unset and the screen shows a
  // farmer search step first.
  RecordReceipt: { farmerId?: string; farmerName?: string } | undefined;
};
