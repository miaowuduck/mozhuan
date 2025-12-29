// --- 4. 摄像头/图片转PDF 模块 ---
export function initCameraModule() {
    const modal = document.getElementById('cameraModal');
    const btnOpen = document.getElementById('cameraBtn');
    const spanClose = document.querySelector('.close-modal');
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const photoList = document.getElementById('photo-list');
    const cameraSelect = document.getElementById('camera-select');
    const btnCapture = document.getElementById('btn-capture');
    const btnGenerateUse = document.getElementById('btn-generate-use');
    const imgUpload = document.getElementById('img-upload');
    let currentStream = null;

    if (!modal || !btnOpen) return;

    // 打开 Modal
    btnOpen.onclick = function() {
        modal.style.display = "block";
        getCameras();
    }

    // 关闭 Modal
    spanClose.onclick = function() {
        closeModal();
    }

    // 点击外部关闭
    window.onclick = function(event) {
        if (event.target == modal) {
            closeModal();
        }
    }

    function closeModal() {
        modal.style.display = "none";
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
            currentStream = null;
        }
    }

    // 初始化 SortableJS
    if (typeof Sortable !== 'undefined') {
        new Sortable(photoList, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            onEnd: updatePageNumbers,
            filter: '.empty-tip'
        });
    }

    // 获取摄像头
    async function getCameras() {
        try {
            await navigator.mediaDevices.getUserMedia({ video: true });
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            
            cameraSelect.innerHTML = '';
            videoDevices.forEach((device, index) => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.text = device.label || `摄像头 ${index + 1}`;
                cameraSelect.appendChild(option);
            });

            if (videoDevices.length > 0) {
                startCamera(videoDevices[0].deviceId);
            }
        } catch (error) {
            console.error("无法访问摄像头:", error);
            // alert("无法访问摄像头，请确保已授予权限。");
        }
    }

    // 启动摄像头
    async function startCamera(deviceId) {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }

        const constraints = {
            video: {
                deviceId: deviceId ? { exact: deviceId } : undefined,
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            }
        };

        try {
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            currentStream = stream;
            video.srcObject = stream;
        } catch (error) {
            console.error("启动摄像头失败:", error);
        }
    }

    cameraSelect.addEventListener('change', (e) => {
        startCamera(e.target.value);
    });

    // 拍照功能
    function capturePhoto() {
        if (!currentStream) return;
        
        // 触发闪光动画
        const flashOverlay = document.querySelector('.flash-overlay');
        if (flashOverlay) {
            flashOverlay.classList.add('active');
            setTimeout(() => {
                flashOverlay.classList.remove('active');
            }, 100);
        }

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imgData = canvas.toDataURL('image/jpeg', 0.85);
        addPhotoToGallery(imgData);
    }

    // 按钮点击拍照
    btnCapture.addEventListener('click', capturePhoto);

    // 点击取景框拍照
    const videoContainer = document.querySelector('.video-container');
    if (videoContainer) {
        videoContainer.addEventListener('click', capturePhoto);
    }

    // 上传图片
    imgUpload.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                addPhotoToGallery(e.target.result);
            };
            reader.readAsDataURL(file);
        });
        // 清空 input 以便重复上传
        imgUpload.value = '';
    });

    function addPhotoToGallery(imgData) {
        const emptyTip = document.querySelector('.empty-tip');
        if (emptyTip) emptyTip.remove();

        const div = document.createElement('div');
        div.className = 'photo-item';
        div.innerHTML = `
            <img src="${imgData}" alt="doc page">
            <button class="delete-btn" onclick="removePhoto(this)">×</button>
            <div class="page-number"></div>
        `;
        photoList.appendChild(div);
        updatePageNumbers();
    }

    // Make removePhoto globally available as it is called from inline onclick
    window.removePhoto = function(btn) {
        const item = btn.parentElement;
        item.remove();
        if (photoList.children.length === 0) {
            photoList.innerHTML = '<div class="empty-tip">拍摄照片将显示在这里，拖拽可排序</div>';
        } else {
            updatePageNumbers();
        }
    };

    function updatePageNumbers() {
        const items = photoList.querySelectorAll('.photo-item');
        items.forEach((item, index) => {
            const numDiv = item.querySelector('.page-number');
            if (numDiv) numDiv.textContent = `第 ${index + 1} 页`;
        });
    }

    // 生成并使用 PDF
    btnGenerateUse.addEventListener('click', async () => {
        const items = photoList.querySelectorAll('.photo-item img');
        if (items.length === 0) {
            alert("请先拍摄或上传至少一张照片");
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const pdfWidth = 210; 
        const pdfHeight = 297; 

        for (let i = 0; i < items.length; i++) {
            const img = items[i];
            if (i > 0) doc.addPage();

            const imgProps = doc.getImageProperties(img.src);
            const imgRatio = imgProps.width / imgProps.height;
            const pageRatio = pdfWidth / pdfHeight;

            let w, h, x, y;
            if (imgRatio > pageRatio) {
                w = pdfWidth;
                h = w / imgRatio;
                x = 0;
                y = (pdfHeight - h) / 2;
            } else {
                h = pdfHeight;
                w = h * imgRatio;
                y = 0;
                x = (pdfWidth - w) / 2;
            }

            doc.addImage(img.src, 'JPEG', x, y, w, h);
        }

        // 生成 Blob
        const pdfBlob = doc.output('blob');
        const date = new Date().toISOString().slice(0,19).replace(/[-T:]/g, '');
        const fileName = `Scan_${date}.pdf`;
        const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

        // 赋值给 fileInput
        const fileInput = document.getElementById('fileInput');
        const dataTransfer = new DataTransfer();
        
        // 如果已有文件，保留它们
        for (let i = 0; i < fileInput.files.length; i++) {
            dataTransfer.items.add(fileInput.files[i]);
        }
        dataTransfer.items.add(file);
        
        fileInput.files = dataTransfer.files;

        // 触发 change 事件
        const event = new Event('change', { bubbles: true });
        fileInput.dispatchEvent(event);

        // 关闭 Modal
        closeModal();

        // 清空图片列表
        photoList.innerHTML = '<div class="empty-tip">拍摄照片将显示在这里，拖拽可排序</div>';
    });
}
