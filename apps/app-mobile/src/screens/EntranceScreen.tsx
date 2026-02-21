import React from 'react';
import colors from '../theme/colors';
import { typography } from '../theme/typography';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import PrimaryButton from '../components/PrimaryButton';
import { useTranslation } from 'react-i18next';
import ParcusPiggy from '../assets/svg/ParcusPiggy.svg';

type Props = NativeStackScreenProps<RootStackParamList, 'Entrance'>;

const EntranceScreen = ({ navigation }: Props) => {
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.imageContainer}>
          <ParcusPiggy width={213} height={189} />
        </View>
        <Text style={styles.title}>{t('entrance.title')}</Text>
        <Text style={styles.subtitle}>{t('entrance.subtitle')}</Text>
      </View>
      <View style={styles.buttonContainer}>
        <PrimaryButton
          label={t('shared.begin')}
          onPress={() => navigation.navigate('CommunityIntro')}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 165,
  },
  imageContainer: {
    marginBottom: 32,
  },
  title: {
    ...typography.h1,
    fontSize: 40,
    color: colors.brand.primary,
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 1,
  },
  subtitle: {
    ...typography.body1,
    textAlign: 'center',
    maxWidth: 280,
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  }
});

export default EntranceScreen;
