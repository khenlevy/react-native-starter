import { SearchResult } from '../ajax/search/search';

export type RootStackParamList = {
  // Onboarding Flow
  Entrance: undefined;
  CommunityIntro: undefined;
  OffersIntro: undefined;
  PayLessIntro: undefined;
  
  // Auth Flow
  Login: undefined;
  VerifyCode: {
    phone: string;
    expiresAt: string;
  };
  
  // Main App Flow
  MyCards: undefined;
  Search: undefined;
  Account: undefined;
  SearchResults: {
    business: SearchResult;
  };
  ResultView: {
    item: SearchResult;
  };
};
