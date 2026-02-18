import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Image, ImageSourcePropType } from 'react-native';
import colors from '../theme/colors';
import { typography } from '../theme/typography';

interface Props {
  label: string;
  onPress: () => void;
  icon: ImageSourcePropType;
  variant: 'apple' | 'google';
}

const SocialButton: React.FC<Props> = ({ label, onPress, icon, variant }) => (
  <TouchableOpacity 
    style={[
      styles.button,
      variant === 'apple' ? styles.appleButton : styles.googleButton
    ]} 
    onPress={onPress}
  >
    <Image source={icon} style={styles.icon} />
    <Text style={[
      styles.text,
      variant === 'apple' ? styles.appleText : styles.googleText
    ]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  appleButton: {
    backgroundColor: colors.common.black,
  },
  googleButton: {
    backgroundColor: colors.common.white,
    borderWidth: 1,
    borderColor: colors.text.secondary,
  },
  icon: {
    width: 24,
    height: 24,
    marginRight: 12,
  },
  text: {
    ...typography.button,
    fontSize: 16,
  },
  appleText: {
    color: colors.common.white,
  },
  googleText: {
    color: colors.text.primary,
  },
});

export default SocialButton; 