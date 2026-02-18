import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import colors from '../../theme/colors';
import EntranceStage from '../../components/EntranceStage';


const OffersIntro = ({ navigation }: any) => {
  const { t } = useTranslation();
  
  return (
    <View style={styles.container}>
      <EntranceStage
        title={t('offersIntro.title')}
        description={t('offersIntro.description')}
        onNext={() => navigation.navigate('PayLessIntro')}
        illustrationImage={require('../../assets/png/Group.png')}
        currentStep={2}
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

export default OffersIntro;
