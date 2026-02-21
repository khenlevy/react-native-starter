import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { useTranslation } from 'react-i18next';
import colors from '../../theme/colors';
import { typography } from '../../theme/typography';
import SocialButton from '../../components/SocialButton';
import PrimaryButton from '../../components/PrimaryButton';
import ParcusPiggy from '../../assets/svg/ParcusPiggy.svg';
import { TextInputMask } from 'react-native-masked-text';
import { authApi } from '../../ajax/auth/auth';

const LoginScreen = ({ navigation }: any) => {
  const { t } = useTranslation();
  const [phone, setPhone] = useState('');

  const handleGoogleLogin = async () => {
    try {
      // In real implementation, we would use react-native-google-signin
      const token = 'dummy-google-token';
      const response = await authApi.googleLogin(token);
      navigation.navigate('Search');
    } catch (error) {
      console.error(error);
    }
  };

  const handleAppleLogin = async () => {
    try {
      // In real implementation, we would use @invertase/react-native-apple-authentication
      const token = 'dummy-apple-token';
      const response = await authApi.appleLogin(token);
      navigation.navigate('Search');
    } catch (error) {
      console.error(error);
    }
  };

  const handlePhoneLogin = async () => {
    try {
      const formattedPhone = `+${phone.replace(/\D/g, '')}`;
      const response = await authApi.phoneLogin(formattedPhone);
      navigation.navigate('VerifyCode', { 
        phone: formattedPhone,
        expiresAt: response.expires_at 
      });
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <ParcusPiggy width={120} height={120} />
        </View>

        <View style={styles.socialButtons}>
          <SocialButton
            label="Continue with Apple"
            onPress={handleAppleLogin}
            icon={require('../../assets/png/apple-logo-white.png')}
            variant="apple"
          />
          <SocialButton
            label="Continue with Google"
            onPress={handleGoogleLogin}
            icon={require('../../assets/png/google-logo.png')}
            variant="google"
          />
        </View>

        <View style={styles.divider}>
          <View style={styles.line} />
          <Text style={styles.orText}>OR</Text>
          <View style={styles.line} />
        </View>

        <View style={styles.phoneSection}>
          <Text style={styles.phoneLabel}>MOBILE</Text>
          <TextInputMask
            type={'custom'}
            options={{
              mask: '+1 (999) 999-9999'
            }}
            value={phone}
            onChangeText={setPhone}
            style={styles.phoneInput}
            placeholder="Enter Your Mobile"
            keyboardType="phone-pad"
          />
          <PrimaryButton
            label="LOG IN"
            onPress={handlePhoneLogin}
          />
        </View>
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
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  socialButtons: {
    marginBottom: 32,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: colors.text.secondary,
    opacity: 0.2,
  },
  orText: {
    ...typography.body1,
    marginHorizontal: 16,
    color: colors.text.primary,
  },
  phoneSection: {
    gap: 16,
  },
  phoneLabel: {
    ...typography.body2,
    color: colors.text.primary,
    fontWeight: '600',
  },
  phoneInput: {
    ...typography.body1,
    borderWidth: 1,
    borderColor: colors.text.secondary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
});

export default LoginScreen; 