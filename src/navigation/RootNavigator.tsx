import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootStackParamList } from './types';

// Onboarding Screens
import EntranceScreen from '../screens/EntranceScreen';
import CommunityIntro from '../screens/on-boarding/CommunityIntro';
import OffersIntro from '../screens/on-boarding/OffersIntro';
import PayLessIntro from '../screens/on-boarding/PayLessIntro';

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import VerifyCodeScreen from '../screens/auth/VerifyCodeScreen';

// Main App Screens
import MyCardsScreen from '../screens/MyCardsScreen';
import SearchScreen from '../screens/SearchScreen';
import AccountScreen from '../screens/AccountScreen';
import SearchResultsScreen from '../screens/SearchResultsScreen';
import ResultView from '../screens/ResultView';

const Stack = createNativeStackNavigator<RootStackParamList>();

const ONBOARDING_COMPLETED_KEY = 'onboardingCompleted';
const AUTHENTICATED_USER_KEY = 'authenticatedUser';

const RootNavigator = () => {
  const [isOnBoardingCompleted, setOnBoardingCompleted] = useState<boolean | null | undefined>(undefined);
  const [currentAuthenticatedUser, setCurrentAuthenticatedUser] = useState<Object | null | undefined>(undefined);

  useEffect(() => {
    handleOnBoardingCompleted();
    handleCurrentAuthenticatedUser();
  }, []);

  const handleOnBoardingCompleted = async () => {
    try {
      const hasLaunched = await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY);
      setOnBoardingCompleted(hasLaunched === null);
    } catch (error) {
      setOnBoardingCompleted(true);
    }
  };

  const handleCurrentAuthenticatedUser = async () => {
    try {
      const userItem = await AsyncStorage.getItem(AUTHENTICATED_USER_KEY);
      const user = userItem ? JSON.parse(userItem) : null;
      setCurrentAuthenticatedUser(user);
    } catch (error) {
      setCurrentAuthenticatedUser(null);
    }
  };

  const isLoading = isOnBoardingCompleted === undefined || currentAuthenticatedUser === undefined;
  if (isLoading) {
    return null;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={"Entrance"}
        //initialRouteName={isFirstLaunch ? "Entrance" : isAuthenticated ? "MyCards" : "Login"}
        screenOptions={{
          headerShown: true,
          animation: 'slide_from_right',
          headerStyle: {
            backgroundColor: '#F9F6FF',
          },
          headerTitleStyle: {
            fontFamily: 'Montserrat-SemiBold',
            fontSize: 20,
          },
          headerShadowVisible: false,
        }}
      >
        {/* Onboarding Flow */}
        <Stack.Group screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Entrance" component={EntranceScreen} />
          <Stack.Screen name="CommunityIntro" component={CommunityIntro} />
          <Stack.Screen name="OffersIntro" component={OffersIntro} />
          <Stack.Screen name="PayLessIntro" component={PayLessIntro} />
        </Stack.Group>

        {/* Auth Flow */}
        <Stack.Group screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="VerifyCode" component={VerifyCodeScreen} />
        </Stack.Group>

        {/* Main App Flow */}
        <Stack.Group>
          <Stack.Screen 
            name="MyCards" 
            component={MyCardsScreen}
            options={{ title: 'My Cards' }}
          />
          <Stack.Screen 
            name="Search" 
            component={SearchScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="Account" 
            component={AccountScreen}
            options={{ title: 'Account' }}
          />
          <Stack.Screen 
            name="SearchResults" 
            component={SearchResultsScreen}
            options={{ title: 'Search Results' }}
          />
          <Stack.Screen 
            name="ResultView" 
            component={ResultView}
            options={{ title: 'Result Details' }}
          />
        </Stack.Group>
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default RootNavigator; 