let totalBill = document.getElementsByClassName("totalBill");
totalBillWallet(totalBill);

let accountBalance = document.getElementsByClassName("balance");
let moneyTransfer = document.getElementsByClassName("money_transfer");
let fee = document.getElementsByClassName("fee");



displayVND(accountBalance);
displayVND(moneyTransfer);
displayVND(fee);

function totalBillWallet(bill) {
  for (let i = 0; i < bill.length; i++) {
    let array = bill[i].innerHTML.split(",");
    let total = Number(array[0]) - Number(array[1]) - Number(array[2]);
    if (total > 0) {
      total = "+" + total;
    }

    // Tiền thêm - Tiền cộng - phí
    bill[i].innerHTML = formatVND(total);
  }
}

function formatVND(money) {
  return money.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,") + " đ";
}

function displayVND(name) {
  name[0].innerHTML = formatVND(Number(name[0].innerHTML));
}
