import java.util.Scanner;
public class TypeSafe {
    public static void main(String[] args) {
        Scanner input = new Scanner(null)
        String message = "Hello, TypeSafe!";
        // System.out.println(message);
        int number = 42;
        // System.out.println("The answer is: " + number);
        double pi = 3.14159;
        // System.out.println("Value of pi: " + pi);
        boolean isJavaFun = true;
        System.out.println("Is Java fun? " + isJavaFun);
        System.out.print("Enter your name: ");
        String name = input.nextLine();
        // System.out.println("Hello, " + name + "!");
        System.out.print("Enter an integer: ");
        int userNumber = input.nextInt(); // Reads integer only, leaves \n in the buffer
        // What would happen if we used nextLine() here instead of nextInt()?
        // It would read the leftover newline character, resulting in an empty string.
        System.out.println("You entered: " + userNumber);
        System.out.print("Enter a decimal number: ");
        double userDecimal = input.nextDouble();
        // 
        System.out.println("You entered: " + userDecimal);
        // printf allows formatted output, similar to C's printf
        System.out.printf("Double: %.2f%nString: %s%nInteger: %d%n", userDecimal, name, userNumber);
    }
}