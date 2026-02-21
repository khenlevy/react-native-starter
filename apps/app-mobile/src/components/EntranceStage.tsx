// src/screens/EntranceScreen.tsx
import React from 'react';
import { View, Text, StyleSheet, Image, ImageSourcePropType, SafeAreaView, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import colors from '../theme/colors';
import { typography } from '../theme/typography';
import PrimaryButton from './PrimaryButton';
import ParcusPiggy from '../assets/svg/ParcusPiggy.svg';

interface EntranceStageProps {
  title: string;
  description: string;
  onNext: () => void;
  illustrationImage: ImageSourcePropType;
  currentStep: number;
  totalSteps?: number;
  showBackButton?: boolean;
  onBack?: () => void;
}

const EntranceStage: React.FC<EntranceStageProps> = ({
  title,
  description,
  onNext,
  illustrationImage,
  currentStep,
  totalSteps = 3,
  showBackButton = true,
  onBack
}) => {
  const { t } = useTranslation();
  const navigation = useNavigation();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          {showBackButton && (
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Text style={styles.backArrow}>←</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.stepIndicator}>{currentStep}/{totalSteps}</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.titleContainer}>
          <ParcusPiggy width={64} height={64} style={styles.icon} />
          <Text style={styles.title}>{title}</Text>
        </View>
        <Text style={styles.description}>{description}</Text>
        <View style={styles.illustration}>
          <Image source={illustrationImage} style={styles.illustrationImage} resizeMode="contain" />
        </View>
      </View>
      <View style={styles.buttonContainer}>
        <PrimaryButton
          label={t('shared.next')}
          onPress={onNext}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    position: 'relative',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  backArrow: {
    fontSize: 24,
    color: colors.text.primary,
  },
  stepIndicator: {
    ...typography.body1,
    fontSize: 16,
    color: colors.text.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  titleContainer: {
    alignItems: 'center',
  },
  icon: {
    marginBottom: 24,
  },
  title: {
    ...typography.h1,
    fontSize: 28,
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    ...typography.body1,
    fontSize: 18,
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 40,
  },
  illustration: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  illustrationImage: {
    width: '100%',
    height: 240,
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  }
});

export default EntranceStage;
