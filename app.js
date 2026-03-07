// Lấy thẻ canvas từ HTML
const canvas = document.getElementById("canvas");

// Lấy context 2D để vẽ lên canvas
const ctx = canvas.getContext("2d");

// Lấy thẻ img (ảnh dùng để tạo particles)
const img = document.getElementById("img");

// Set kích thước canvas full màn hình
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Mảng chứa tất cả particles
let particles = [];

// Khi ảnh load xong thì chạy code bên trong
img.onload = () => {

  // Vẽ ảnh lên canvas tại vị trí (200,100)
  ctx.drawImage(img, 200, 100);

  // Lấy toàn bộ dữ liệu pixel của vùng ảnh vừa vẽ
  const data = ctx.getImageData(200, 100, img.width, img.height);

  // Loop qua từng pixel theo chiều dọc
  for (let y = 0; y < data.height; y += 2) {

    // Loop qua từng pixel theo chiều ngang
    for (let x = 0; x < data.width; x += 2) {

      // Tính vị trí index của pixel trong mảng data
      // mỗi pixel có 4 giá trị: r,g,b,a
      const index = (y * data.width + x) * 4;

      // Lấy màu đỏ
      const r = data.data[index];

      // Lấy màu xanh lá
      const g = data.data[index + 1];

      // Lấy màu xanh dương
      const b = data.data[index + 2];

      // Lấy alpha (độ trong suốt)
      const a = data.data[index + 3];

      // Nếu pixel không trong suốt
      if (a > 128) {

        // Vị trí đích của particle (pixel của ảnh)
        const targetX = 200 + x;
        const targetY = 100 + y;

        // Tạo particle mới
        particles.push({

          // Vị trí ban đầu random khắp màn hình
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,

          // Vị trí đích mà particle sẽ bay tới
          targetX: targetX,
          targetY: targetY,

          // Màu của particle giống màu pixel
          color: `rgb(${r},${g},${b})`
        });

      }

    }
  }

  // Bắt đầu animation
  animate();
};


// Hàm animation chạy liên tục
function animate() {

  // Xóa toàn bộ frame cũ
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Loop qua tất cả particles
  particles.forEach(p => {

    // Khoảng cách từ particle tới vị trí đích
    const dx = p.targetX - p.x;
    const dy = p.targetY - p.y;
    if(Math.abs(dx) < 1 && Math.abs(dy) < 1) {
      // Nếu particle đã gần đến target thì set vị trí bằng target luôn
      p.x = p.targetX;
      p.y = p.targetY;
    }
    // Di chuyển particle dần về target
    // 0.05 = tốc độ di chuyển
    p.x += dx * 0.1;
    p.y += dy * 0.1;

    // Set màu particle
    ctx.fillStyle = p.color;

    // Vẽ particle kích thước 1x1 pixel
    ctx.fillRect(p.x, p.y, 1, 1);

  });

  // Gọi lại animate ở frame tiếp theo (~60fps)
  requestAnimationFrame(animate);
}