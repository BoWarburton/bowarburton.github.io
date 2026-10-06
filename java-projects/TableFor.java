public class TableFor {
    public static void main(String[] args) {
        for (int row = 1; row <= 5; row++) {
            for (int column = 1; column <= 5; column++) {
                System.out.printf("%d", row * column);
            }
            System.out.println();
        }
    }
}