import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import colors from '../../theme/colors';
import HomeIcon from '../../assets/icons/li_home.svg';
import SearchIcon from '../../assets/icons/li_search.svg';
import UserIcon from '../../assets/icons/li_user.svg';

export type BottomBarProps = {
  style?: any;
};

const ACTIVE_COLOR = colors.brand.primary;
const INACTIVE_COLOR = '#A6A6A6';

const BottomBar: React.FC<BottomBarProps> = ({ style }) => {
  const navigation = useNavigation();
  const route = useRoute();

  const tabs = [
    { name: 'My Cards', icon: HomeIcon, route: 'MyCards' },
    { name: 'Search', icon: SearchIcon, route: 'Search' },
    { name: 'Account', icon: UserIcon, route: 'Account' },
  ];

  const isActive = (routeName: string) => route.name === routeName;

  return (
    <View style={[styles.container, style]}>
      {tabs.map((tab) => {
        const TabIcon = tab.icon;
        const active = isActive(tab.route);
        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tab}
            onPress={() => navigation.navigate(tab.route as never)}
          >
            <TabIcon
              width={25}
              height={24}
              color={active ? ACTIVE_COLOR : INACTIVE_COLOR}
            />
            <Text
              style={[
                styles.tabText,
                active && styles.activeTabText,
                { color: active ? ACTIVE_COLOR : INACTIVE_COLOR },
              ]}
            >
              {tab.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    height: Platform.select({ ios: 85, android: 60 }),
    backgroundColor: '#3C3C3C',
    paddingBottom: Platform.select({ ios: 25, android: 0 }),
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  tab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabText: {
    fontSize: 16,
    marginTop: 6,
    fontFamily: 'Montserrat-Regular',
  },
  activeTabText: {
    fontFamily: 'Montserrat-SemiBold',
  },
});

export default BottomBar; 