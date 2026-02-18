import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import colors from '../theme/colors';
import { typography } from '../theme/typography';

type Props = {
  label: string;
  onPress: () => void;
};

const PrimaryButton = ({ label, onPress }: Props) => (
  <TouchableOpacity style={styles.button} onPress={onPress}>
    <Text style={styles.text}>{label}</Text>
  </TouchableOpacity>
);

export default PrimaryButton;

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.brand.primary,
    paddingVertical: 18,
    borderRadius: 100,
    width: '100%',
    alignItems: 'center',
    shadowColor: colors.common.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  text: {
    ...typography.button,
  },
});
