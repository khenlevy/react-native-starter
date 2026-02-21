import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import colors from '../../theme/colors';
import EntranceStage from '../../components/EntranceStage';

const CommunityIntro = ({ navigation }: any) => {
  const { t } = useTranslation();
  
  return (
    <View style={styles.container}>
      <EntranceStage
        title={t('communityIntro.title')}
        description={t('communityIntro.description')}
        onNext={() => navigation.navigate('OffersIntro')}
        illustrationImage={require('../../assets/png/Group.png')}
        currentStep={1}
        showBackButton={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.brand.background,
  },
});

export default CommunityIntro;
