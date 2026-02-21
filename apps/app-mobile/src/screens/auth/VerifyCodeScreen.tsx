import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { useTranslation } from 'react-i18next';
import colors from '../../theme/colors';
import { typography } from '../../theme/typography';
import PrimaryButton from '../../components/PrimaryButton';
import { authApi } from '../../ajax/auth/auth';
import {
  CodeField,
  Cursor,
  useBlurOnFulfill,
  useClearByFocusCell,
} from 'react-native-confirmation-code-field';

const CELL_COUNT = 6;

const VerifyCodeScreen = ({ route, navigation }: any) => {
  const { t } = useTranslation();
  const { phone } = route.params;
  const [value, setValue] = useState('');
  const ref = useBlurOnFulfill({ value, cellCount: CELL_COUNT });
  const [props, getCellOnLayoutHandler] = useClearByFocusCell({
    value,
    setValue,
  });

  const handleVerify = async () => {
    try {
      const response = await authApi.verifyCode(phone, value);
      navigation.navigate('Search');
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{t('verifyCode.title')}</Text>
        <Text style={styles.description}>
          {t('verifyCode.description', { phone })}
        </Text>

        <CodeField
          ref={ref}
          {...props}
          value={value}
          onChangeText={setValue}
          cellCount={CELL_COUNT}
          rootStyle={styles.codeFieldRoot}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          renderCell={({ index, symbol, isFocused }) => (
            <View
              key={index}
              style={[styles.cell, isFocused && styles.focusCell]}
              onLayout={getCellOnLayoutHandler(index)}>
              <Text style={styles.cellText}>
                {symbol || (isFocused ? <Cursor /> : null)}
              </Text>
            </View>
          )}
        />

        <PrimaryButton
          label={t('shared.verify')}
          onPress={handleVerify}
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
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  title: {
    ...typography.h1,
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    ...typography.body1,
    textAlign: 'center',
    marginBottom: 32,
  },
  codeFieldRoot: {
    marginBottom: 32,
  },
  cell: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: colors.text.secondary,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  focusCell: {
    borderColor: colors.brand.primary,
  },
  cellText: {
    ...typography.h2,
    color: colors.text.primary,
  },
});

export default VerifyCodeScreen; 