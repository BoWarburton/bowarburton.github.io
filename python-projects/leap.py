# leap year
def find_leapyear(y):
    if (y % 4 != 0) or (y % 100 == 0 and y % 400 != 0):
        return 0
    else:
        return 1
year = int(input("Year: "))
if find_leapyear(year) == 1:
    print("Leap year")
else:
    print("not a leap year")
