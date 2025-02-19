```ts
const testFileUpload = async () => {
        const file = new Blob(['Hello, MinIO from React!'], { type: 'text/plain' });
        const response = await fetch('http://localhost:3000/api/v1/storage/upload/test-from-react.txt', {
            method: 'POST',
            body: file,
            headers: {
                'Content-Type': 'text/plain'
            }
        });
        const result = await response.json();
        console.log('File upload result:', result);
    };
    ```