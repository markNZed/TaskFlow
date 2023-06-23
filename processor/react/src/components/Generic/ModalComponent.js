import React, { useEffect, useState } from 'react';
import { Button, Modal, Box, Typography } from '@mui/material';

// This modal detects changes to modalInfo and pops up on that change

const ModalComponent = ({ modalInfo }) => {
  const [modalOpen, setModalOpen] = useState(false);

  const handleModalOpen = () => {
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
  };

  useEffect(() => {
    if (modalInfo.title && modalInfo.description) {
      handleModalOpen();
    }
  }, [modalInfo]);

  const modalStyle = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 400,
    bgcolor: 'background.paper',
    border: '2px solid #000',
    boxShadow: 24,
    p: 4,
  };

  return (
    <div>
      <Modal
        open={modalOpen}
        onClose={handleModalClose}
        aria-labelledby="modal-title"
        aria-describedby="modal-description"
      >
        <Box sx={modalStyle}>
          <Typography id="modal-title" variant="h6" component="h2">
            {modalInfo.title}
          </Typography>
          <Typography id="modal-description" sx={{ mt: 2 }}>
            {modalInfo.description}
          </Typography>
          <Button onClick={handleModalClose}>Close Modal</Button>
        </Box>
      </Modal>
    </div>
  );
};

export default ModalComponent;
