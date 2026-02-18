import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import colors from '../../theme/colors';
import EntranceStage from '../../components/EntranceStage';

const PayLessIntro = ({ navigation }: any) => {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <EntranceStage
        title={t('payLessIntro.title')}
        description={t('payLessIntro.description')}
        onNext={() => navigation.navigate('Login')}
        illustrationImage={require('../../assets/png/Group.png')}
        currentStep={3}
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

export default PayLessIntro;
