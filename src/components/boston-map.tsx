import { Text, View } from 'react-native';

type Coordinate = {
  latitude: number;
  longitude: number;
};

type Props = {
  guess: Coordinate | null;
  answer: Coordinate | null;
  onGuess: (coordinate: Coordinate) => void;
};

export default function BostonMap(_props: Props) {
  return (
    <View style={{ padding: 24 }}>
      <Text>Open this practice game on your iPhone to use the map.</Text>
    </View>
  );
}